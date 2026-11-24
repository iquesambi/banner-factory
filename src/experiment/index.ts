/**
 * Measuring the banners, and testing one against another.
 *
 * The order matters and it is the order the design asks for: measure first,
 * and only run a test when the measurement says something is wrong. A shop
 * that A/B tests everything spends its traffic proving that most of its
 * banners are fine.
 *
 * Two files, kept apart on purpose:
 *
 *   `.cache/traffic.json`     what each banner was shown and clicked
 *   `.cache/experiments.json` the tests, their variants and their verdicts
 *
 * Traffic exists without experiments — every banner is measured whether or
 * not anything is being tested on it — and an experiment is a comparison
 * between two banners that both have traffic of their own.
 *
 * REAL AND SIMULATED ARE NEVER ADDED TOGETHER. There is no live site behind
 * this yet, so there is a simulator, and the single most dangerous thing this
 * module could do is let its output look like evidence. Every tally carries
 * both and every reader has to choose which it is looking at.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Language } from '../banner/facts.js';
import type { LayoutName } from '../banner/brief.js';
import { compare, readingOf, requiredPerArm, type Comparison, type Reading } from './stats.js';

/* ----------------------------------------------------------------- traffic */

export interface Counts { impressions: number; clicks: number }
export interface Tally {
  real: Counts;
  simulated: Counts;
  firstAt: string | null;
  lastAt: string | null;
}

export type TrafficBook = Record<string, Tally>;

const TRAFFIC_PATH = '.cache/traffic.json';
const EXPERIMENTS_PATH = '.cache/experiments.json';

const emptyTally = (): Tally => ({
  real: { impressions: 0, clicks: 0 },
  simulated: { impressions: 0, clicks: 0 },
  firstAt: null,
  lastAt: null,
});

function readJson<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    /* a broken file is not worth taking a page down for */
  }
  return fallback;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync('.cache', { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

export function loadTraffic(): TrafficBook {
  return readJson<TrafficBook>(TRAFFIC_PATH, {});
}

export function saveTraffic(book: TrafficBook): void {
  writeJson(TRAFFIC_PATH, book);
}

export type Event = 'impression' | 'click';

/**
 * Records one event against one banner.
 *
 * `simulated` is not an afterthought parameter: it decides which of two
 * separate counters moves, and nothing downstream ever sums them.
 */
export function record(
  book: TrafficBook,
  jobId: string,
  event: Event,
  simulated: boolean,
  times = 1,
): TrafficBook {
  const tally = book[jobId] ?? emptyTally();
  const side = simulated ? tally.simulated : tally.real;
  if (event === 'impression') side.impressions += times;
  else side.clicks += times;
  const now = new Date().toISOString();
  tally.firstAt ??= now;
  tally.lastAt = now;
  return { ...book, [jobId]: tally };
}

export type Source = 'real' | 'simulated';

/**
 * Which numbers to show for this banner, and whether they are real.
 *
 * Real traffic wins whenever there is any: a banner with ten real
 * impressions and ten thousand simulated ones is a banner with ten
 * impressions, and showing the simulated figure because it is bigger would
 * be the lie this module exists to prevent.
 */
export function countsOf(tally: Tally | undefined): { counts: Counts; source: Source } {
  if (!tally) return { counts: { impressions: 0, clicks: 0 }, source: 'real' };
  if (tally.real.impressions > 0) return { counts: tally.real, source: 'real' };
  if (tally.simulated.impressions > 0) return { counts: tally.simulated, source: 'simulated' };
  return { counts: tally.real, source: 'real' };
}

/* -------------------------------------------------------------- experiments */

/** What a variant is allowed to change. One thing at a time, always. */
export type Dimension = 'layout' | 'cta' | 'copy';

export interface Change {
  dimension: Dimension;
  /** For `layout`: which of the three arrangements to use instead. */
  layout?: LayoutName;
  /** For `cta`: the button text, which must still come from the closed list. */
  cta?: string;
  /**
   * For `copy`: a direction for the copywriter, never the copy itself.
   *
   * The researcher does not write banner text. If it did, the text would
   * skip every check that makes copy safe — the number rules, the language
   * rules, the closed button list — and the first variant with an invented
   * price would be the end of this feature.
   */
  copyDirection?: string;
  /** What the researcher expects to happen, and why. */
  hypothesis: string;
}

export type ExperimentState = 'proposed' | 'building' | 'running' | 'decided' | 'abandoned';

export interface Decision {
  winner: 'control' | 'variant' | 'neither';
  at: string;
  by: string;
  p: number;
  relativeLift: number;
  impressions: number;
  reading: Reading;
  note: string;
  /** Whether the numbers behind it were real traffic or the simulator. */
  source: Source;
}

export interface Experiment {
  id: string;
  createdAt: string;
  sku: string;
  product: string;
  language: Language;
  state: ExperimentState;
  /** The banner that is already live, and the one being tried against it. */
  controlJobId: string;
  variantJobId: string | null;
  change: Change;
  /** The reading of the control's performance that justified opening this. */
  because: string;
  /** Fixed before any data arrives, so the test cannot be stopped when it flatters us. */
  requiredPerArm: number;
  baselineRate: number;
  decision: Decision | null;
  /** Set once the result has been handed to the prompt-improvement loop. */
  learnedAt: string | null;
}

export type ExperimentBook = { version: number; experiments: Experiment[] };

export function loadExperiments(): ExperimentBook {
  return readJson<ExperimentBook>(EXPERIMENTS_PATH, { version: 1, experiments: [] });
}

export function saveExperiments(book: ExperimentBook): ExperimentBook {
  const next = { ...book, version: book.version + 1 };
  writeJson(EXPERIMENTS_PATH, next);
  return next;
}

export interface OpenInput {
  sku: string;
  product: string;
  language: Language;
  controlJobId: string;
  change: Change;
  because: string;
  baselineRate: number;
  /** The smallest relative improvement worth acting on. */
  mde?: number;
}

/**
 * Opens a test. One per product at a time, which is not a technical limit:
 * two tests on the same banner split the same traffic and each other's
 * results, and neither finishes.
 */
export function open(book: ExperimentBook, input: OpenInput): { book: ExperimentBook; experiment: Experiment } {
  const live = book.experiments.find(
    (e) => e.sku === input.sku && e.language === input.language && (e.state === 'running' || e.state === 'building' || e.state === 'proposed'),
  );
  if (live) throw new Error(`there is already a test open on ${input.product}`);

  const experiment: Experiment = {
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    sku: input.sku,
    product: input.product,
    language: input.language,
    state: 'proposed',
    controlJobId: input.controlJobId,
    variantJobId: null,
    change: input.change,
    because: input.because,
    requiredPerArm: requiredPerArm(input.baselineRate, input.mde ?? 0.2),
    baselineRate: input.baselineRate,
    decision: null,
    learnedAt: null,
  };
  return { book: { ...book, experiments: [...book.experiments, experiment] }, experiment };
}

export function update(book: ExperimentBook, id: string, patch: Partial<Experiment>): ExperimentBook {
  return {
    ...book,
    experiments: book.experiments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
}

export function experimentOf(book: ExperimentBook, id: string): Experiment | null {
  return book.experiments.find((e) => e.id === id) ?? null;
}

/** The test running on this banner, if one is. */
export function liveFor(book: ExperimentBook, controlJobId: string): Experiment | null {
  return (
    book.experiments.find(
      (e) => e.controlJobId === controlJobId && (e.state === 'running' || e.state === 'building' || e.state === 'proposed'),
    ) ?? null
  );
}

export interface Measured {
  comparison: Comparison;
  reading: Reading;
  source: Source;
  /** True while both arms are still filling up. */
  needs: number;
}

/**
 * Where a test stands right now.
 *
 * The reading is the honest part: until both arms reach the sample that was
 * fixed when the test opened, the answer is "peek", however tempting the
 * p-value looks.
 */
export function measure(experiment: Experiment, traffic: TrafficBook): Measured {
  const control = countsOf(traffic[experiment.controlJobId]);
  const variant = countsOf(experiment.variantJobId ? traffic[experiment.variantJobId] : undefined);
  /** If either side is simulated, the pair is: they are not comparable otherwise. */
  const source: Source =
    control.source === 'simulated' || variant.source === 'simulated' ? 'simulated' : 'real';

  const comparison = compare(control.counts, variant.counts);
  return {
    comparison,
    reading: readingOf(comparison, experiment.requiredPerArm),
    source,
    needs: Math.max(
      0,
      experiment.requiredPerArm - Math.min(control.counts.impressions, variant.counts.impressions),
    ),
  };
}

/**
 * Closes a test and says what it found.
 *
 * "neither" is the common outcome and it is a real one. Most variants are
 * the same as the thing they replaced, and recording that honestly is what
 * keeps the next researcher from proposing it again.
 */
export function decide(
  book: ExperimentBook,
  id: string,
  traffic: TrafficBook,
  by: string,
  note = '',
): { book: ExperimentBook; decision: Decision } {
  const experiment = experimentOf(book, id);
  if (!experiment) throw new Error(`no experiment ${id}`);

  const m = measure(experiment, traffic);
  const winner: Decision['winner'] =
    m.reading !== 'conclusive' ? 'neither' : m.comparison.absoluteLift > 0 ? 'variant' : 'control';

  const decision: Decision = {
    winner,
    at: new Date().toISOString(),
    by,
    p: m.comparison.p,
    relativeLift: m.comparison.relativeLift,
    impressions: m.comparison.control.impressions + m.comparison.variant.impressions,
    reading: m.reading,
    note,
    source: m.source,
  };

  return { book: update(book, id, { state: 'decided', decision }), decision };
}

/* ------------------------------------------------- how a banner is doing */

export type Standing = 'no-data' | 'too-early' | 'ahead' | 'behind' | 'even';

export interface Performance {
  jobId: string;
  counts: Counts;
  source: Source;
  rate: number;
  /** The rate across every other measured banner, which is what "well" means here. */
  baseline: number;
  standing: Standing;
  p: number;
  /** Below this many impressions nothing is said at all. */
  minimum: number;
}

/** A banner needs at least this many impressions before it is judged. */
export const MIN_IMPRESSIONS = 500;

/**
 * Is this banner doing well?
 *
 * Against the shop's own banners, not against an industry number nobody can
 * check. The comparison is this banner's click rate against the rate of
 * every other measured banner put together, which is the only baseline this
 * system can actually observe.
 */
export function performanceOf(
  jobId: string,
  traffic: TrafficBook,
  minimum = MIN_IMPRESSIONS,
): Performance {
  const mine = countsOf(traffic[jobId]);

  const rest: Counts = { impressions: 0, clicks: 0 };
  for (const [id, tally] of Object.entries(traffic)) {
    if (id === jobId) continue;
    const { counts, source } = countsOf(tally);
    /** Like with like: simulated numbers are only ever compared to simulated ones. */
    if (source !== mine.source) continue;
    rest.impressions += counts.impressions;
    rest.clicks += counts.clicks;
  }

  const rate = mine.counts.impressions > 0 ? mine.counts.clicks / mine.counts.impressions : 0;
  const baseline = rest.impressions > 0 ? rest.clicks / rest.impressions : 0;
  const c = compare(rest, mine.counts);

  let standing: Standing;
  if (mine.counts.impressions === 0) standing = 'no-data';
  else if (mine.counts.impressions < minimum || rest.impressions < minimum) standing = 'too-early';
  else if (c.p >= 0.05) standing = 'even';
  else standing = rate > baseline ? 'ahead' : 'behind';

  return { jobId, counts: mine.counts, source: mine.source, rate, baseline, standing, p: c.p, minimum };
}
