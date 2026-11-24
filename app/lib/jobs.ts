import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { recommendWorkflow, composeWorkflow, artDirectWorkflow } from '@/src/mastra/index.js';
import { onRunEvent, type RunEvent } from '@/src/events/index.js';
import { buildBrief } from '@/src/banner/brief.js';
import type { Language } from '@/src/banner/facts.js';
import type { RecommendResult } from '@/src/mastra/workflows/recommend.js';
import type { ComposeResult } from '@/src/mastra/workflows/compose.js';
import type { ArtDirectResult } from '@/src/mastra/workflows/art-direct.js';
import { get as findProduct } from './search.js';
import { priceSource } from '@/src/cost/index.js';
import { forPicks, forSeed, validate, type ReuseHit } from './reuse.js';
import { loadRules } from './rules.js';
import { deleteBanner, uploadBanner } from '@/src/banner/storage.js';
import { REDO_MEANS, type Job, type Verdict, type VerdictStage } from './types.js';

export type { Job } from './types.js';

const JOB_DIR = '.cache/jobs';

/** For the one sentence that says which language a reused banner was in. */
const LANGUAGE_NAME: Record<Language, string> = { da: 'Danish', sv: 'Swedish', en: 'English' };

/**
 * Jobs live in memory and are written through to disk on every change.
 *
 * The memory copy is what the board reads; the files are what survives a
 * server restart. A real deployment would put this in Firestore, and the
 * shape here is the same document the design assumes.
 *
 * It hangs off `globalThis` on purpose. In development Next re-evaluates the
 * server modules whenever it recompiles, which gives this file a FRESH set of
 * module variables while the `run()` promise from the previous copy is still
 * in flight. With the map and the queue as plain module state, that reload
 * looked exactly like a process restart: the new copy read the files, saw a
 * job in `drawing` with nobody working on it, and failed it — while the work
 * carried on and finished into a map nothing was reading any more. That is
 * the "the server restarted while this was running" every other run showed.
 *
 * One object, shared by every copy of the module in this process, so a
 * recompile is what it actually is: a code change, not a restart.
 */
interface Runtime {
  jobs: Map<string, Job>;
  loaded: boolean;
  /** One job at a time. The free tier is rate limited, and the board reads better. */
  chain: Promise<void>;
}

const runtime: Runtime = ((globalThis as { __bannerFactoryJobs?: Runtime }).__bannerFactoryJobs ??= {
  jobs: new Map<string, Job>(),
  loaded: false,
  chain: Promise.resolve(),
});

const jobs = runtime.jobs;

function save(job: Job): void {
  jobs.set(job.id, job);
  try {
    mkdirSync(JOB_DIR, { recursive: true });
    writeFileSync(`${JOB_DIR}/${job.id}.json`, JSON.stringify(job, null, 2));
  } catch {
    /* The board still works from memory; losing the file is not worth failing a run. */
  }
}

/**
 * Fills in fields added after a job was written.
 *
 * Jobs are JSON on disk and the shape has grown — reuse, money, photographs.
 * A file written before a field existed has it as `undefined`, and the screen
 * that reads `job.reuseRejected.length` then takes the whole page down, which
 * is exactly what happened. Everything a screen touches gets a default here,
 * on the way in, so no reader has to guess which version wrote the file.
 */
function normalise(raw: Partial<Job>): Job {
  const cost = raw.cost ?? { calls: 0, tokens: 0, avoided: 0, usd: null, rateReadAt: null, byStep: [] };
  return {
    ...(raw as Job),
    cost: {
      calls: cost.calls ?? 0,
      tokens: cost.tokens ?? 0,
      avoided: cost.avoided ?? 0,
      usd: cost.usd ?? null,
      rateReadAt: cost.rateReadAt ?? null,
      byStep: (cost.byStep ?? []).map((b) => ({ ...b, usd: b.usd ?? null })),
    },
    seed: { ...(raw.seed as Job['seed']), image: raw.seed?.image ?? null },
    pick: raw.pick ? { ...raw.pick, image: raw.pick.image ?? null } : null,
    picks: raw.picks ?? (raw.pick ? [raw.pick] : []),
    pickIndex: raw.pickIndex ?? 0,
    decision: raw.decision ?? null,
    events: raw.events ?? [],
    headlineLines: raw.headlineLines ?? [],
    audience: raw.audience ?? null,
    storage: raw.storage ?? null,
    storageNote: raw.storageNote ?? null,
    reuse: raw.reuse ?? null,
    reuseRejected: raw.reuseRejected ?? [],
    reuseOptOut: raw.reuseOptOut ?? false,
    verdicts: raw.verdicts ?? {},
    pid: raw.pid ?? null,
    forced: raw.forced ?? null,
    variant: raw.variant ?? null,
  };
}

/**
 * Is somebody still working on this?
 *
 * The pid on the job says who took it. This process counts, and so does
 * another process that is still running — two dev servers against the same
 * `.cache` is an ordinary accident, and the second one reading the files must
 * not fail the first one's work. Signal 0 asks the kernel whether a pid
 * exists without touching it.
 */
function alive(pid: number | null): boolean {
  if (pid === null) return false;
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function loadAll(): void {
  if (runtime.loaded) return;
  runtime.loaded = true;
  if (!existsSync(JOB_DIR)) return;
  for (const f of readdirSync(JOB_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const job = normalise(JSON.parse(readFileSync(`${JOB_DIR}/${f}`, 'utf8')) as Partial<Job>);
      /**
       * A job that was mid-flight when the PROCESS died cannot be resumed:
       * nothing is listening for its events any more. Marking it failed is
       * honest, where leaving it "drawing" for ever is not.
       *
       * The pid is what tells the two cases apart. A job stamped with this
       * very process is still being worked on — we are reading the files
       * because the module was reloaded, not because anything died — and
       * failing it would be a lie about work that is still happening.
       */
      if (!alive(job.pid) && !['ready', 'review', 'failed'].includes(job.stage)) {
        job.stage = 'failed';
        job.error = job.error ?? 'the server stopped while this was running';
        job.pid = null;
      }
      jobs.set(job.id, job);
    } catch {
      /* a half-written file from a crash; skip it */
    }
  }
}

export function listJobs(): Job[] {
  loadAll();
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id: string): Job | null {
  loadAll();
  return jobs.get(id) ?? null;
}

/**
 * One stage's verdict.
 *
 * Nothing about the card moves: being unhappy with the copy and publishing
 * the banner anyway is a normal decision, and a judgement that blocks the
 * work stops being a judgement and becomes a gate.
 */
export function rateStage(
  id: string,
  stage: VerdictStage,
  value: 'up' | 'down' | null,
  by: string | null,
  source: Verdict['source'] = 'thumb',
): Job | null {
  const job = getJob(id);
  if (!job) return null;

  if (value === null) delete job.verdicts[stage];
  else job.verdicts[stage] = { value, at: new Date().toISOString(), by, source };

  if (job.stage === 'review') job.stage = 'ready';
  save(job);
  return job;
}

/* ------------------------------------------------------------- the runner */

type Started = { status: string; result?: unknown; error?: unknown };

/**
 * Runs one workflow and forwards its stage events to the job while it goes.
 *
 * `createRun()` hands over the run id before `start()`, which is what makes
 * the subscription possible: by the time the first event fires, the listener
 * is already attached.
 */
interface RunnableWorkflow {
  createRun(): Promise<{ runId: string; start: (a: unknown) => Promise<Started> }>;
}

async function runWorkflow<T>(
  workflow: unknown,
  inputData: unknown,
  label: string,
  onEvent: (e: RunEvent) => void,
): Promise<T> {
  /**
   * Called as a method, never through a local alias. `createRun` reads a
   * private field on the workflow, so pulling it into a variable detaches the
   * receiver and it fails with "Cannot read properties of undefined". That is
   * exactly how this broke the first time it ran.
   */
  const run = await (workflow as RunnableWorkflow).createRun();
  const off = onRunEvent(run.runId, onEvent);
  try {
    const out = await run.start({ inputData });
    if (out.status !== 'success') {
      // Never surface the raw provider error: it carries the request body.
      const e = out.error as { message?: string; name?: string; statusCode?: number } | undefined;
      const bits = [e?.name, e?.statusCode ? `HTTP ${e.statusCode}` : null, e?.message ?? String(out.status)]
        .filter(Boolean)
        .join(' · ');
      throw new Error(`${label}: ${bits}`);
    }
    return out.result as T;
  } finally {
    off();
  }
}

/**
 * What a run can be told to do before it starts.
 *
 * `forPick` is the whole of it: a product named up front, which skips the
 * matcher entirely. The seed button names the seed; the translate button
 * names the product already on the banner it is translating.
 */
export interface EnqueueOptions {
  reuseOptOut?: boolean;
  forPick?: { sku: string; how: 'seed' | 'translation'; fromJobId?: string | null };
  /**
   * The other half of an A/B test. A variant always makes its own banner:
   * reuse is turned off for it, because adopting an existing image would
   * produce a variant identical to something that is not the control.
   */
  variantOf?: Job['variant'];
}

export function enqueue(sku: string, language: Language, options: EnqueueOptions = {}): Job {
  const product = findProduct(sku);
  if (!product) throw new Error(`sku ${sku} is not in the catalogue`);

  const forced = options.forPick ?? null;
  if (forced && !findProduct(forced.sku)) {
    throw new Error(`sku ${forced.sku} is not in the catalogue`);
  }

  const job: Job = {
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    stage: 'queued',
    audience: null,
    verdicts: {},
    picks: [],
    pickIndex: 0,
    decision: null,
    storage: null,
    storageNote: null,
    language,
    seed: {
      sku: product.sku,
      name: product.name,
      price: product.price,
      stockBand: product.stockBand,
      image: product.image,
    },
    pick: null,
    brief: null,
    headlineLines: [],
    events: [],
    cost: { calls: 0, tokens: 0, avoided: 0, usd: null, rateReadAt: null, byStep: [] },
    png: null,
    error: null,
    reuse: null,
    reuseRejected: [],
    reuseOptOut: options.variantOf ? true : (options.reuseOptOut ?? false),
    pid: null,
    forced: forced ? { sku: forced.sku, how: forced.how, fromJobId: forced.fromJobId ?? null } : null,
    variant: options.variantOf ?? null,
  };
  save(job);

  runtime.chain = runtime.chain.then(() => run(job)).catch(() => undefined);
  return job;
}

/**
 * Adds one stage's money to the job, and keeps the total null if any stage
 * could not be priced. A partial total would read as the cost of the banner
 * when it is the cost of part of it.
 */
function addMoney(job: Job, usd: number | null): void {
  if (usd === null) return;
  job.cost.usd = (job.cost.usd ?? 0) + usd;
  job.cost.rateReadAt = priceSource().readAt;
}

/**
 * One line of the cost table: what the stage was, what it called, what it
 * spent and how long it took.
 *
 * The time is measured here rather than read off the stage events, because
 * each workflow counts its own elapsed time from its own start. Summing
 * those would double-count the gaps and undercount everything that happens
 * outside a workflow — the render, the upload.
 */
function addStep(
  job: Job,
  step: { name: string; calls: number; tokens: number; usd: number | null; ms: number },
): void {
  job.cost.calls += step.calls;
  job.cost.tokens += step.tokens;
  addMoney(job, step.usd);
  job.cost.ms = (job.cost.ms ?? 0) + step.ms;
  job.cost.byStep.push(step);
}

/**
 * How far down the matcher's list a banner may be reused from.
 *
 * This is the first business rule that actually runs. It lives in the rule
 * set, so turning it off on the Rules screen turns off this saving, and
 * raising the position changes how aggressive it is. Off by rule means no
 * reuse from the list at all — only an exact seed hit.
 */
function reuseDepth(): number {
  return loadRules().reuseDepth;
}

/** The other half of the saving, and also a rule rather than a constant. */
function seedReuseAllowed(): boolean {
  return loadRules().reuseSeed;
}

/**
 * Takes the banner from an earlier job and makes it this job's answer.
 *
 * Nothing is copied that was not already true of that banner: the same image
 * file, the same brief, the same chosen product. The cost already spent on
 * this job stays on it, so a seed hit reads as free and a hit found after the
 * matcher ran reads as the one call it cost.
 */
function adopt(job: Job, hit: ReuseHit, note: string): void {
  const from = hit.job;
  job.pick = from.pick;
  job.brief = from.brief;
  job.headlineLines = from.headlineLines;
  job.png = from.png;
  job.reuse = { fromJobId: from.id, how: hit.how, rank: hit.rank, note };
  /**
   * A banner a person already approved does not need approving twice; one
   * that was never rated still wants a look in its new context.
   */
  job.stage = 'ready';
  save(job);
}

type Collect = (e: RunEvent) => void;

const collectorFor = (job: Job): Collect => (e) => {
  job.events.push({ seq: job.events.length + 1, stage: e.stage, elapsedMs: e.elapsedMs, data: e.data });
  save(job);
};

/**
 * The run, in three parts that can each be done again on their own.
 *
 * It used to be one function, which was fine while a banner was only ever
 * made once. Disagreeing with it changes that: saying "not that product"
 * has to redo choosing, writing and drawing, while "not that copy" has to
 * keep the product and redo only the last two. The seam has to exist in the
 * code for the board to offer it.
 *
 * Each part reads what the one before it left on the job, so a redo needs no
 * state of its own.
 */
async function stageChoose(job: Job, collect: Collect): Promise<boolean> {
  job.stage = 'choosing';
  save(job);

    /**
     * Before anything is spent: have we already made a banner from this very
     * seed, in this language, that is still true today? That hit skips
     * choosing, writing and drawing, so the run costs nothing at all.
     */
    if (!job.reuseOptOut && seedReuseAllowed()) {
      const all = listJobs();
      const hit = forSeed(all, job.seed.sku, job.language, job.id);
      if (hit) {
        adopt(job, hit, `Already made from this seed on ${day(hit.job.createdAt)}, and every fact it shows still holds.`);
        return false;
      }
      /** Say why a near miss was refused; silence here looks like a bug. */
      for (const other of all) {
        if (other.id === job.id || other.seed.sku !== job.seed.sku || other.language !== job.language) continue;
        if (!other.png) continue;
        const why = rejectionOf(other);
        if (why) job.reuseRejected.push(why);
      }
    }

    const startedChoosing = Date.now();
    const rec = await runWorkflow<RecommendResult>(
      recommendWorkflow,
      { sku: job.seed.sku, validateSeed: true, validatePool: false, verbose: false },
      'recommend',
      collect,
    );
    job.cost.avoided += rec.cost.callsAvoidedByCache;
    addStep(job, {
      name: 'Choosing the product',
      calls: rec.cost.calls,
      tokens: rec.cost.totalTokens,
      usd: rec.cost.usd,
      ms: Date.now() - startedChoosing,
    });

    /**
     * Keep the reading that produced the pick, not just the pick. With the
     * seed in stock the banner is a suggestion, and a suggestion without its
     * reasoning is unreviewable — the person rating it has to be able to see
     * who it was aimed at and which parts of the shop were searched.
     */
    if (rec.mode === 'suggest') {
      job.audience = {
        mode: 'suggest',
        cluster: rec.cluster,
        profile: rec.profile,
        sections: rec.categories,
      };
      save(job);
    }

    job.picks = rec.picks.map((p) => ({
      sku: p.sku, name: p.name, price: p.price, reason: p.reason, image: p.image,
    }));
    job.pickIndex = 0;
    job.decision = rec.decision;

    const pick = job.picks[0];
    if (!pick) {
      throw new Error(rec.noneReason ?? 'no candidate was a fair substitute');
    }
    job.pick = pick;

    /**
     * The matcher has spoken. If one of the products it offered near the top
     * already has a valid banner, that banner is the answer: writing and
     * drawing are skipped and only the one call to choose was spent.
     */
    const depth = reuseDepth();
    if (!job.reuseOptOut && depth > 0) {
      const hit = forPicks(listJobs(), rec.picks, job.language, depth, job.id);
      if (hit) {
        const place = hit.rank === 1 ? 'the first choice' : `choice ${hit.rank} of ${rec.picks.length}`;
        adopt(
          job,
          hit,
          `${place} already had a banner from ${day(hit.job.createdAt)}, and every fact it shows still holds. Reuse is allowed down to position ${depth} by the rule set.`,
        );
        return false;
      }
    }

  return true;
}

/**
 * The product was named, so nothing is chosen.
 *
 * Both buttons that land here already know the answer: "make the banner for
 * the seed" means the seed, and "make this one in Swedish" means the product
 * that is already on it. Running the matcher would spend a call to be told
 * what the request said, and in the translation case it could come back with
 * a different product, which would not be a translation of anything.
 *
 * Returns false when an existing banner answered it, the same as the matcher
 * path does.
 */
function stageForced(job: Job): boolean {
  const forced = job.forced;
  if (!forced) return true;

  const product = findProduct(forced.sku);
  if (!product) throw new Error(`${forced.sku} is no longer in the catalogue`);

  job.stage = 'choosing';
  job.picks = [{
    sku: product.sku,
    name: product.name,
    price: product.price,
    image: product.image,
    reason: forced.how === 'seed'
      ? 'Asked for directly: this is the product the customer was looking at, not a recommendation.'
      : 'Asked for directly: the same product as the banner this one translates.',
  }];
  job.pickIndex = 0;
  job.pick = job.picks[0]!;
  job.decision = forced.how === 'seed' ? 'asked-seed' : 'asked-translation';
  job.events.push({
    seq: job.events.length + 1,
    stage: 'pick.changed',
    elapsedMs: 0,
    data: {
      reason: forced.how === 'seed' ? 'a person asked for the seed itself' : 'a person asked for another language',
      now: product.name,
      cost: 'no model call',
    },
  });
  save(job);

  /**
   * A banner for this product in this language may already exist — clicking
   * translate twice, or translating into a language it was first made in.
   * The same validity check as every other reuse applies.
   */
  if (!job.reuseOptOut) {
    const hit = forPicks(listJobs(), [{ sku: product.sku }], job.language, 1, job.id);
    if (hit) {
      adopt(
        job,
        hit,
        `This product already had a ${LANGUAGE_NAME[job.language]} banner from ${day(hit.job.createdAt)}, and every fact it shows still holds.`,
      );
      return false;
    }
  }
  return true;
}

/** Copy and badges for whatever product is currently chosen. */
async function stageWrite(job: Job, collect: Collect): Promise<void> {
  const pick = job.pick;
  if (!pick) throw new Error('there is no chosen product to write about');

  job.stage = 'writing';
  save(job);

    /**
     * The one thing a variant changes. Everything else about this run is
     * identical to the control's, which is the only way the measurement
     * afterwards can be attributed to anything.
     */
    const change = job.variant?.change;
    const startedWriting = Date.now();
    const comp = await runWorkflow<ComposeResult>(
      composeWorkflow,
      {
        sku: pick.sku,
        language: job.language,
        verbose: false,
        ...(change?.dimension === 'copy' && change.copyDirection
          ? { direction: change.copyDirection }
          : {}),
        ...(change?.dimension === 'cta' && change.cta ? { forceCta: change.cta } : {}),
      },
      'compose',
      collect,
    );
    addStep(job, {
      name: 'Writing and deciding',
      calls: comp.cost.calls,
      tokens: comp.cost.inputTokens + comp.cost.outputTokens,
      usd: comp.cost.usd,
      ms: Date.now() - startedWriting,
    });

    if (!comp.copy) throw new Error('the copy did not pass its checks');

    const brief = buildBrief({
      language: job.language,
      seed: job.seed,
      decision: job.decision ?? 'unknown',
      chosenBecause: pick.reason,
      facts: comp.facts,
      copy: comp.copy,
      show: comp.show,
      finePrint: comp.finePrint,
      ...(change?.dimension === 'layout' && change.layout ? { layout: change.layout } : {}),
    });
    job.brief = brief;
  save(job);
}

/** The layout and the render, from the brief the writing stage left. */
async function stageDraw(job: Job, collect: Collect): Promise<void> {
  const brief = job.brief;
  const pick = job.pick;
  if (!brief || !pick) throw new Error('there is nothing to draw yet');

  job.stage = 'drawing';
  save(job);

    const startedDrawing = Date.now();
    const art = await runWorkflow<ArtDirectResult>(
      artDirectWorkflow,
      { brief, outDir: '.cache/banners', name: `${job.id}-${pick.sku}-${job.language}`, verbose: false },
      'art-direct',
      collect,
    );
    addStep(job, {
      name: 'Laying out and drawing',
      calls: art.cost.calls,
      tokens: art.cost.inputTokens + art.cost.outputTokens,
      usd: art.cost.usd,
      ms: Date.now() - startedDrawing,
    });
    job.headlineLines = art.direction.headlineLines;

    if (art.renderError) throw new Error(art.renderError);
    job.png = art.render ? art.render.png.split('/').pop() ?? null : null;

    /**
     * Published to Cloud Storage, after the file exists and never instead of
     * it. The render is the most expensive step in the pipeline, so an upload
     * that fails is recorded on the job and the banner is still delivered.
     */
    if (art.render && job.png) {
      const { upload, skipped } = await uploadBanner(art.render.png, {
        name: job.png,
        metadata: { sku: pick.sku, language: job.language, jobId: job.id },
      });
      job.storage = upload ? { ...upload, uploadedAt: new Date().toISOString() } : null;
      job.storageNote = skipped;
      save(job);
    }

    /**
     * Drawn, and that is finished. It used to land in a review column, which
     * was a holding pen a person had to empty by hand; the thumbs on the card
     * are the review, and they work from here.
     */
    job.stage = 'ready';
  save(job);
}

/**
 * The whole run, and the only path a new job takes.
 *
 * `stageChoose` returning false means it answered from an existing banner,
 * so there is nothing left to write or draw.
 */
async function run(job: Job): Promise<void> {
  const collect = collectorFor(job);
  /**
   * Whose work this is. Written before anything starts and cleared when it
   * ends, so a module reload can see that the run is alive and leave it be.
   */
  job.pid = process.pid;
  save(job);
  try {
    const more = job.forced ? stageForced(job) : await stageChoose(job, collect);
    if (!more) return;
    await stageWrite(job, collect);
    await stageDraw(job, collect);
  } catch (error) {
    job.stage = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
  } finally {
    job.pid = null;
    save(job);
  }
}

/** One line saying why an existing banner could not be reused. */
function rejectionOf(job: Job): string | null {
  const check = validate(job);
  if (check.ok) return null;
  const what = job.pick?.name ?? job.seed.name;
  return `${what}: ${check.reasons.join('; ')}`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------- disagreeing with a run */

/**
 * Throws a card away.
 *
 * Only ever asked for about a card that is stuck, so it is a real delete and
 * not an archive: the job file goes, and so does the banner in Cloud Storage
 * if this job is the only one pointing at it. The PNG on disk stays, because
 * another job may have adopted it and because it costs nothing to keep.
 */
export async function deleteJob(id: string): Promise<boolean> {
  loadAll();
  const job = jobs.get(id);
  if (!job) return false;

  const sharedWith = [...jobs.values()].filter((j) => j.id !== id && j.png && j.png === job.png);
  if (job.storage && !sharedWith.length) await deleteBanner(job.storage.path).catch(() => false);

  jobs.delete(id);
  try {
    rmSync(`${JOB_DIR}/${id}.json`);
  } catch {
    /* already gone, which is the state we wanted */
  }
  return true;
}

export type RedoStage = 'choosing' | 'writing' | 'drawing';

/**
 * Doing a stage again, and everything after it.
 *
 * This is how a person disagrees. Dragging a card back to Choosing says "not
 * that product": the next candidate the matcher offered takes its place, and
 * the copy and the artwork are made again for it. Dragging it back to
 * Writing keeps the product and says "not those words". Drawing keeps both
 * and says "not that layout".
 *
 * Going back to Choosing does NOT run the matcher again when there is
 * another candidate on the list. The matcher already ranked them and the
 * policy already applied the rules; re-running it would pay for the same
 * answer and most likely return the same product. Only an exhausted list
 * sends the run back to the beginning.
 */
export async function redoFrom(id: string, from: RedoStage): Promise<Job | null> {
  loadAll();
  const job = jobs.get(id);
  if (!job) return null;

  const collect = collectorFor(job);
  job.error = null;
  /** A redone banner is not the old one's reuse of anything. */
  job.reuse = null;
  job.pid = process.pid;

  /**
   * Dragging a card back IS the feedback, and the strongest kind the board
   * collects: a thumb costs a click, while this costs a rerun. It is
   * recorded against the stage that was rejected, marked as revealed rather
   * than stated, before the work starts — so a redo that fails still leaves
   * the judgement behind.
   */
  job.verdicts[REDO_MEANS[from]] = {
    value: 'down',
    at: new Date().toISOString(),
    by: null,
    source: 'redo',
  };
  save(job);

  /** Every stage this redo will remake, so their old verdicts can be cleared. */
  const redone: VerdictStage[] =
    from === 'choosing' ? ['choice', 'copy', 'layout']
    : from === 'writing' ? ['copy', 'layout']
    : ['layout'];

  try {
    if (from === 'choosing') {
      const next = job.pickIndex + 1;
      if (next < job.picks.length) {
        job.pickIndex = next;
        job.pick = job.picks[next]!;
        job.events.push({
          seq: job.events.length + 1,
          stage: 'pick.changed',
          elapsedMs: 0,
          data: {
            reason: 'a person rejected the previous choice',
            now: job.pick.name,
            position: next + 1,
            of: job.picks.length,
          },
        });
        save(job);
      } else {
        /**
         * Nothing left on the list, so the matcher runs again from scratch.
         * A job whose product was named by hand stops being one here: asking
         * for a different product is asking to be recommended one, and only
         * the matcher can do that.
         */
        job.picks = [];
        job.pickIndex = 0;
        job.pick = null;
        job.forced = null;
        const more = await stageChoose(job, collect);
        if (!more) return job;
      }
    }

    if (from === 'choosing' || from === 'writing') {
      job.brief = null;
      job.headlineLines = [];
      await stageWrite(job, collect);
    }

    job.png = null;
    job.storage = null;
    job.storageNote = null;
    await stageDraw(job, collect);

    /**
     * What was remade has not been judged yet. The verdict that CAUSED the
     * redo is cleared with it: it was about the old output, and leaving it
     * on the card would read as a complaint about work nobody has seen.
     */
    for (const stage of redone) delete job.verdicts[stage];
  } catch (error) {
    job.stage = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
  } finally {
    job.pid = null;
    save(job);
  }
  return job;
}
