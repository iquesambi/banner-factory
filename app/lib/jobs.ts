import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { recommendWorkflow, composeWorkflow, artDirectWorkflow } from '@/src/mastra/index.js';
import { onRunEvent, type RunEvent } from '@/src/events/index.js';
import { buildBrief } from '@/src/banner/brief.js';
import type { Language } from '@/src/banner/facts.js';
import type { RecommendResult } from '@/src/mastra/workflows/recommend.js';
import type { ComposeResult } from '@/src/mastra/workflows/compose.js';
import type { ArtDirectResult } from '@/src/mastra/workflows/art-direct.js';
import { get as findProduct } from './search.js';
import type { Job } from './types.js';

export type { Job } from './types.js';

const JOB_DIR = '.cache/jobs';

/**
 * Jobs live in memory and are written through to disk on every change.
 *
 * The memory copy is what the board reads; the files are what survives a
 * server restart, which in development happens on every file save. A real
 * deployment would put this in Firestore, and the shape here is the same
 * document the design assumes.
 */
const jobs = new Map<string, Job>();
let loaded = false;

function save(job: Job): void {
  jobs.set(job.id, job);
  try {
    mkdirSync(JOB_DIR, { recursive: true });
    writeFileSync(`${JOB_DIR}/${job.id}.json`, JSON.stringify(job, null, 2));
  } catch {
    /* The board still works from memory; losing the file is not worth failing a run. */
  }
}

function loadAll(): void {
  if (loaded) return;
  loaded = true;
  if (!existsSync(JOB_DIR)) return;
  for (const f of readdirSync(JOB_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const job = JSON.parse(readFileSync(`${JOB_DIR}/${f}`, 'utf8')) as Job;
      /**
       * A job that was mid-flight when the process died cannot be resumed:
       * nothing is listening for its events any more. Marking it failed is
       * honest, where leaving it "drawing" for ever is not.
       */
      if (!['ready', 'review', 'failed'].includes(job.stage)) {
        job.stage = 'failed';
        job.error = job.error ?? 'the server restarted while this was running';
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

export function rateJob(id: string, rating: 'up' | 'down' | null, reason: string | null): Job | null {
  const job = getJob(id);
  if (!job) return null;
  job.rating = rating;
  job.ratingReason = reason;
  /** A thumb up is the sign-off: the human review this board is waiting for. */
  if (rating === 'up' && job.stage === 'review') job.stage = 'ready';
  if (rating === 'down' && job.stage === 'ready') job.stage = 'review';
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

/** One job at a time. The free tier is rate limited, and the board reads better. */
let chain: Promise<void> = Promise.resolve();

export function enqueue(sku: string, language: Language): Job {
  const product = findProduct(sku);
  if (!product) throw new Error(`sku ${sku} is not in the catalogue`);

  const job: Job = {
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    stage: 'queued',
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
    cost: { calls: 0, tokens: 0, avoided: 0, byStep: [] },
    png: null,
    error: null,
    rating: null,
    ratingReason: null,
  };
  save(job);

  chain = chain.then(() => run(job)).catch(() => undefined);
  return job;
}

async function run(job: Job): Promise<void> {
  const collect = (e: RunEvent) => {
    job.events.push({ seq: job.events.length + 1, stage: e.stage, elapsedMs: e.elapsedMs, data: e.data });
    save(job);
  };

  try {
    job.stage = 'choosing';
    save(job);

    const rec = await runWorkflow<RecommendResult>(
      recommendWorkflow,
      { sku: job.seed.sku, validateSeed: true, validatePool: false, verbose: false },
      'recommend',
      collect,
    );
    job.cost.calls += rec.cost.calls;
    job.cost.tokens += rec.cost.totalTokens;
    job.cost.avoided += rec.cost.callsAvoidedByCache;
    job.cost.byStep.push({ name: 'Choosing the product', calls: rec.cost.calls, tokens: rec.cost.totalTokens });

    const pick = rec.picks[0];
    if (!pick) {
      throw new Error(rec.noneReason ?? 'no candidate was a fair substitute');
    }
    job.pick = {
      sku: pick.sku,
      name: pick.name,
      price: pick.price,
      reason: pick.reason,
      image: pick.image,
    };

    job.stage = 'writing';
    save(job);

    const comp = await runWorkflow<ComposeResult>(
      composeWorkflow,
      { sku: pick.sku, language: job.language, verbose: false },
      'compose',
      collect,
    );
    const writeTokens = comp.cost.inputTokens + comp.cost.outputTokens;
    job.cost.calls += comp.cost.calls;
    job.cost.tokens += writeTokens;
    job.cost.byStep.push({ name: 'Writing and deciding', calls: comp.cost.calls, tokens: writeTokens });

    if (!comp.copy) throw new Error('the copy did not pass its checks');

    const brief = buildBrief({
      language: job.language,
      seed: job.seed,
      decision: rec.decision,
      chosenBecause: pick.reason,
      facts: comp.facts,
      copy: comp.copy,
      show: comp.show,
      finePrint: comp.finePrint,
    });
    job.brief = brief;

    job.stage = 'drawing';
    save(job);

    const art = await runWorkflow<ArtDirectResult>(
      artDirectWorkflow,
      { brief, outDir: '.cache/banners', name: `${job.id}-${pick.sku}-${job.language}`, verbose: false },
      'art-direct',
      collect,
    );
    const artTokens = art.cost.inputTokens + art.cost.outputTokens;
    job.cost.calls += art.cost.calls;
    job.cost.tokens += artTokens;
    job.cost.byStep.push({ name: 'Laying out', calls: art.cost.calls, tokens: artTokens });
    job.headlineLines = art.direction.headlineLines;

    if (art.renderError) throw new Error(art.renderError);
    job.png = art.render ? art.render.png.split('/').pop() ?? null : null;

    /** Drawn, and now waiting for a person. There is no reviewer agent yet. */
    job.stage = 'review';
    save(job);
  } catch (error) {
    job.stage = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    save(job);
  }
}
