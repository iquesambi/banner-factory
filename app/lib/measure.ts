import 'server-only';
import { CostMeter, readUsage } from '@/src/cost/index.js';
import { RpmThrottle, withRetry } from '@/src/mastra/rpm.js';
import {
  RESEARCHER_MODEL, researchPrompt, researchSchema, uxResearcher,
  type PastTest, type ResearchAnswer,
} from '@/src/mastra/agents/ux-researcher.js';
import { CTA_OPTIONS } from '@/src/banner/facts.js';
import { LAYOUTS } from '@/src/banner/brief.js';
import {
  countsOf, decide, experimentOf, liveFor, loadExperiments, loadTraffic, measure, open,
  performanceOf, saveExperiments, type Change, type Experiment, type Measured, type Performance,
} from '@/src/experiment/index.js';
import { pct } from '@/src/experiment/stats.js';
import { enqueue, getJob, listJobs } from './jobs.js';
import { VERDICT_LABEL, VERDICT_STAGES, type Job } from './types.js';

/**
 * The measurement tool, and the A/B tests that come out of it.
 *
 * Measure first. A banner that is doing fine is left alone — testing it
 * spends traffic to find out what we already know — and only one that is
 * measurably behind the others is worth a researcher's time and a variant's
 * render.
 */

export interface Row {
  job: Job;
  performance: Performance;
  experiment: Experiment | null;
  measured: Measured | null;
  /**
   * The thumbs left on the board: which part somebody approved or rejected.
   * Not words — there is no field for those — and not the same kind of
   * evidence as traffic.
   */
  verdicts: string[];
}

/** One row per delivered banner, newest first. */
export function rows(): Row[] {
  const traffic = loadTraffic();
  const book = loadExperiments();

  /** One row per banner image, like every other screen: a reuse is not a second banner. */
  const byImage = new Map<string, Job>();
  for (const job of listJobs()) {
    if (!job.png || !job.brief) continue;
    /** A variant has a row of its own only through its experiment. */
    if (job.variant) continue;
    const held = byImage.get(job.png);
    if (!held || (held.reuse && !job.reuse)) byImage.set(job.png, job);
  }

  return [...byImage.values()].map((job) => {
    const experiment = liveFor(book, job.id) ?? lastDecided(book.experiments, job.id);
    return {
      job,
      performance: performanceOf(job.id, traffic),
      experiment,
      measured: experiment ? measure(experiment, traffic) : null,
      verdicts: verdictLines(job),
    };
  });
}

function lastDecided(experiments: Experiment[], jobId: string): Experiment | null {
  return (
    [...experiments]
      .filter((e) => e.controlJobId === jobId && e.state === 'decided')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

function verdictLines(job: Job): string[] {
  return VERDICT_STAGES.filter((s) => job.verdicts[s]).map((s) => {
    const v = job.verdicts[s]!;
    const how = v.source === 'redo' ? 'rejected and paid to be redone' : v.value === 'up' ? 'approved' : 'rejected';
    return `${VERDICT_LABEL[s]}: ${how}`;
  });
}

/** The measurement, in the one sentence the researcher is given. */
export function measurementLine(p: Performance): string {
  if (p.standing === 'no-data') return 'nothing has been measured yet';
  const base = `${p.counts.clicks} clicks in ${p.counts.impressions} impressions — ${pct(p.rate)} against ${pct(p.baseline)} across the other banners`;
  const tail =
    p.standing === 'too-early' ? ` (too little data to call: under ${p.minimum} impressions)`
    : p.standing === 'behind' ? ` — behind, p = ${p.p.toFixed(3)}`
    : p.standing === 'ahead' ? ` — ahead, p = ${p.p.toFixed(3)}`
    : ' — no measurable difference';
  const source = p.source === 'simulated' ? ' [SIMULATED TRAFFIC, not real]' : '';
  return base + tail + source;
}

/* ------------------------------------------------------- asking the researcher */

export interface Proposal {
  answer: ResearchAnswer;
  change: Change;
  usd: number | null;
  /** What was corrected in the answer before it was accepted. */
  fixes: string[];
}

/**
 * Asks what to try, and refuses to take an unusable answer at face value.
 *
 * The model picks a dimension and then has to supply the thing that goes
 * with it. A proposal that says "change the button" without naming a
 * permitted button is not a proposal, and quietly inventing one here would
 * put an unchecked string on a banner.
 */
export async function propose(jobId: string): Promise<Proposal> {
  const job = getJob(jobId);
  if (!job?.brief) throw new Error('that banner has no brief to work from');

  const traffic = loadTraffic();
  const book = loadExperiments();
  const performance = performanceOf(job.id, traffic);

  const past: PastTest[] = book.experiments
    .filter((e) => e.sku === job.brief!.product.sku && e.decision)
    .map((e) => ({
      dimension: e.change.dimension,
      what: whatOf(e.change),
      hypothesis: e.change.hypothesis,
      outcome:
        e.decision!.winner === 'variant'
          ? `the variant won, ${pct(e.decision!.relativeLift, 1)} better, p = ${e.decision!.p.toFixed(3)}`
          : e.decision!.winner === 'control'
            ? `the variant lost, p = ${e.decision!.p.toFixed(3)}`
            : `no difference was found (${e.decision!.reading})`,
    }));

  const meter = new CostMeter();
  const throttle = new RpmThrottle();
  const prompt = researchPrompt({
    product: `${job.brief.product.name} · ${job.brief.product.priceText}`,
    language: job.language,
    headline: job.brief.copy.headline,
    accent: job.brief.copy.accent,
    support: job.brief.copy.support,
    cta: job.brief.copy.cta,
    badges: job.brief.badges.map((b) => `${b.kind} (${b.value})`),
    layout: job.brief.design.layout,
    measurement: measurementLine(performance),
    verdicts: verdictLines(job),
    past,
  });

  await throttle.take();
  const began = Date.now();
  const result = await withRetry(() =>
    uxResearcher.generate(prompt, { structuredOutput: { schema: researchSchema } }),
  );
  meter.record('research', RESEARCHER_MODEL, await readUsage(result), Date.now() - began);
  const answer = (result as { object?: ResearchAnswer }).object;
  if (!answer) throw new Error('the researcher gave no answer');

  const fixes: string[] = [];
  const change: Change = { dimension: answer.dimension, hypothesis: answer.hypothesis };

  if (answer.dimension === 'layout') {
    const current = job.brief.design.layout;
    const asked = answer.layout && answer.layout !== current ? answer.layout : null;
    if (!asked) {
      /** A layout variant that keeps the same layout is not a variant. */
      const others = (Object.keys(LAYOUTS) as Array<keyof typeof LAYOUTS>).filter((l) => l !== current);
      change.layout = others[0]!;
      fixes.push(`the researcher asked for the arrangement already in use, so ${change.layout} was taken instead`);
    } else {
      change.layout = asked;
    }
  }

  if (answer.dimension === 'cta') {
    const allowed = CTA_OPTIONS[job.language];
    const asked = (answer.cta ?? '').trim();
    if (!allowed.includes(asked) || asked === job.brief.copy.cta) {
      const alternative = allowed.find((c) => c !== job.brief!.copy.cta)!;
      fixes.push(
        asked
          ? `"${asked}" is not a permitted button in this language, so ${alternative} was taken instead`
          : `no button was named, so ${alternative} was taken instead`,
      );
      change.cta = alternative;
    } else {
      change.cta = asked;
    }
  }

  if (answer.dimension === 'copy') {
    const direction = (answer.copyDirection ?? '').trim();
    if (!direction) throw new Error('the researcher asked to change the copy but gave no direction');
    change.copyDirection = direction;
  }

  return { answer, change, usd: meter.summary().usd, fixes };
}

export function whatOf(change: Change): string {
  if (change.dimension === 'layout') return `the ${change.layout} arrangement`;
  if (change.dimension === 'cta') return `the button "${change.cta}"`;
  return change.copyDirection ?? 'new copy';
}

/* ------------------------------------------------------------ running a test */

/**
 * Opens the test and starts building the variant.
 *
 * The required sample is fixed here, from the rate the control is already
 * getting. Doing it now rather than when the data looks interesting is the
 * difference between a test and a search for a number below 0.05.
 */
export function openTest(jobId: string, change: Change, because: string): Experiment {
  const job = getJob(jobId);
  if (!job?.brief) throw new Error('that banner has no brief to work from');

  const traffic = loadTraffic();
  const { counts } = countsOf(traffic[job.id]);
  const baselineRate = counts.impressions > 0 ? counts.clicks / counts.impressions : 0.02;

  const opened = open(loadExperiments(), {
    sku: job.brief.product.sku,
    product: job.brief.product.name,
    language: job.language,
    controlJobId: job.id,
    change,
    because,
    baselineRate,
  });

  const variant = enqueue(job.brief.product.sku, job.language, {
    forPick: { sku: job.brief.product.sku, how: 'seed', fromJobId: job.id },
    variantOf: { experimentId: opened.experiment.id, controlJobId: job.id, change },
  });

  saveExperiments({
    ...opened.book,
    experiments: opened.book.experiments.map((e) =>
      e.id === opened.experiment.id ? { ...e, variantJobId: variant.id, state: 'building' } : e,
    ),
  });

  return { ...opened.experiment, variantJobId: variant.id, state: 'building' };
}

/**
 * Moves a test from building to running once its variant exists.
 *
 * Checked when the page is read rather than pushed from the runner: the
 * runner knows nothing about experiments, and keeping it that way means a
 * banner is made the same way whether or not it is part of one.
 */
export function refresh(): void {
  const book = loadExperiments();
  let changed = false;
  const experiments = book.experiments.map((e) => {
    if (e.state !== 'building' || !e.variantJobId) return e;
    const variant = getJob(e.variantJobId);
    if (variant?.png) {
      changed = true;
      return { ...e, state: 'running' as const };
    }
    if (variant?.stage === 'failed') {
      changed = true;
      return { ...e, state: 'abandoned' as const };
    }
    return e;
  });
  if (changed) saveExperiments({ ...book, experiments });
}

export function stopTest(id: string, by: string, note = ''): Experiment {
  const traffic = loadTraffic();
  const { book } = decide(loadExperiments(), id, traffic, by, note);
  saveExperiments(book);
  return experimentOf(book, id)!;
}

export function abandonTest(id: string): void {
  const book = loadExperiments();
  saveExperiments({
    ...book,
    experiments: book.experiments.map((e) => (e.id === id ? { ...e, state: 'abandoned' } : e)),
  });
}
