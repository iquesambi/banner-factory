/**
 * Shapes shared by the server runner and the screens.
 *
 * They live apart from `jobs.ts` because that module is server-only — it
 * reaches for the filesystem and for Mastra — while the board and the card
 * need the same types in the browser.
 */
import type { ArtDirectorBrief } from '@/src/banner/brief.js';
import type { Language } from '@/src/banner/facts.js';
import type { Change } from '@/src/experiment/index.js';

export const STAGES = ['queued', 'choosing', 'writing', 'drawing', 'review', 'ready', 'failed'] as const;
export type Stage = (typeof STAGES)[number];

/** The columns the board shows, in order. `failed` is a card state, not a column. */
/**
 * The columns, and one that is deliberately missing.
 *
 * `review` and `ready` were two columns for one situation: a banner exists
 * and a person has not decided about it yet. Splitting them meant every
 * finished banner landed in a holding pen and had to be moved by hand before
 * anyone could do anything with it. Now a finished banner is ready, and the
 * thumbs on the card are the review.
 *
 * `review` survives as a STAGE because jobs on disk were written with it.
 * `inStage` folds it into ready, so an old card lands in the right column
 * without anyone rewriting the files.
 */
export const BOARD_COLUMNS: ReadonlyArray<{ stage: Stage; title: string; dot: string }> = [
  { stage: 'queued', title: 'Queued', dot: '#cbd5e1' },
  { stage: 'choosing', title: 'Choosing', dot: '#0e2d7c' },
  { stage: 'writing', title: 'Writing', dot: '#0e2d7c' },
  { stage: 'drawing', title: 'Drawing', dot: '#0e2d7c' },
  { stage: 'ready', title: 'Ready', dot: '#4d7d14' },
];

/**
 * The stages a card can be dragged back to.
 *
 * Each redoes itself and everything after it: Choosing takes the next
 * product off the list the matcher ranked, Writing keeps the product and
 * writes new copy, Drawing keeps both and lays it out again.
 */
export const REDO_STAGES: ReadonlyArray<Stage> = ['choosing', 'writing', 'drawing'];

export const LANGUAGE_LABEL: Record<Language, string> = {
  da: 'Dansk',
  sv: 'Svenska',
  en: 'English',
};

/** The three things a person judges, each made by a different agent. */
export const VERDICT_STAGES = ['choice', 'copy', 'layout'] as const;
export type VerdictStage = (typeof VERDICT_STAGES)[number];

export const VERDICT_LABEL: Record<VerdictStage, string> = {
  choice: 'The product',
  copy: 'The words',
  layout: 'The layout',
};

export const VERDICT_BY_AGENT: Record<VerdictStage, string> = {
  choice: 'matcher and business policy',
  copy: 'copywriter and strategist',
  layout: 'art director',
};

export interface Verdict {
  value: 'up' | 'down';
  at: string;
  /** Who said so, when anyone was signed in. */
  by: string | null;
  /**
   * How we learned it, and the two are not the same strength of evidence.
   *
   * `thumb` is stated: someone pressed a button. `redo` is revealed —
   * they dragged the card back to that stage, which means they disliked it
   * enough to spend money doing it again. Keeping them apart matters,
   * because a training set should be able to weigh them differently.
   */
  source: 'thumb' | 'redo';
}

export type Verdicts = Partial<Record<VerdictStage, Verdict>>;

/** The stage a redo belongs to, as a verdict about what that stage produced. */
export const REDO_MEANS: Record<'choosing' | 'writing' | 'drawing', VerdictStage> = {
  choosing: 'choice',
  writing: 'copy',
  drawing: 'layout',
};

export interface JobEvent {
  seq: number;
  stage: string;
  elapsedMs: number;
  data: Record<string, unknown>;
}

export interface JobCost {
  calls: number;
  tokens: number;
  avoided: number;
  /** Null until a rate exists for every model used, never a guess. */
  usd: number | null;
  /** The day the price table was read, shown so the figure can be doubted. */
  rateReadAt: string | null;
  /**
   * Wall-clock time spent inside the workflows, summed over the stages.
   *
   * Not the time from the request to the banner: a job waits its turn in a
   * queue of one, and that wait is a property of this machine rather than of
   * the work. Undefined on a job written before this was measured.
   */
  ms?: number;
  byStep: Array<{
    name: string;
    calls: number;
    tokens: number;
    usd: number | null;
    /** How long that stage took, undefined on older job files. */
    ms?: number;
  }>;
}

export interface Job {
  id: string;
  createdAt: string;
  /**
   * When anything last changed on this job.
   *
   * It is what tells a slow stage from a stuck one. `createdAt` cannot: a
   * job that has been drawing for an hour and a job that started an hour ago
   * and is on its third stage look the same from there. Undefined on job
   * files written before this existed, and read as `createdAt`.
   */
  touchedAt?: string;
  stage: Stage;
  language: Language;
  seed: { sku: string; name: string; price: number; stockBand: string; image: string | null };
  pick: { sku: string; name: string; price: number; reason: string; image: string | null } | null;
  /**
   * Everything the matcher offered, in the order it ended up after the
   * business policy spoke, with `pickIndex` saying which one is on the
   * banner.
   *
   * Kept so that disagreeing with the choice costs nothing. Dragging a card
   * back to Choosing takes the next one off this list instead of running the
   * whole matcher again, which is both free and the honest reading of "I did
   * not like that one".
   */
  picks: Array<{ sku: string; name: string; price: number; reason: string; image: string | null }>;
  pickIndex: number;
  /** How the product was reached: seed-in-stock, exact-variant, promo-seed … */
  decision: string | null;
  brief: ArtDirectorBrief | null;
  headlineLines: string[];
  events: JobEvent[];
  cost: JobCost;
  /** File name under .cache/banners, served through /api/banners. */
  png: string | null;
  /**
   * Whether this banner is out in the world.
   *
   * It used to be read off the Cloud Storage upload, which was convenient
   * and wrong: an upload is a copy being made, not a decision being taken.
   * Publishing is a decision — it says this is the banner a visitor may be
   * shown — so it is its own flag, false until somebody says otherwise, and
   * it is what the demo shop serves and the metrics page measures.
   */
  published?: boolean;
  /**
   * The same banner in Cloud Storage, once it was uploaded.
   *
   * Separate from `png` rather than replacing it: the local file is what the
   * render produced and what the app serves today, and the upload is a
   * publication of it that can fail, be switched off, or simply not be
   * configured. Null means the banner exists only on this machine.
   */
  storage: { path: string; url: string; bytes: number; uploadedAt: string } | null;
  /** Why the upload did not happen, when it did not. Shown, not swallowed. */
  storageNote: string | null;
  error: string | null;
  /**
   * The process working on this job right now, null when nobody is.
   *
   * It exists so that reading the job files can tell "the server died
   * mid-run" from "the dev server recompiled and this module was re-evaluated
   * while the run carried on". Without it, every recompile during a run ended
   * with a perfectly good job marked failed.
   */
  pid: number | null;
  /**
   * Set when the matcher was skipped and this product was asked for by name.
   *
   * Two buttons do that: the banner for the seed itself, and the same banner
   * in another language. Both already know which product belongs on it, so
   * paying a model to choose one would be paying for an answer we have — and
   * a translation that is free to pick a different product is not a
   * translation.
   */
  /**
   * Set when this banner exists to be tested against another one.
   *
   * It is an ordinary job in every other way — same workflows, same checks,
   * same card on the board — differing only by the one thing the researcher
   * asked to change. That is what makes the comparison mean something: if a
   * variant took a different path through the system, the test would be
   * measuring the path.
   */
  variant: {
    experimentId: string;
    controlJobId: string;
    change: Change;
  } | null;
  forced: {
    sku: string;
    /** `seed` for the seed product, `translation` for another language of a banner. */
    how: 'seed' | 'translation';
    /** The job this was asked for from, when it came from one. */
    fromJobId: string | null;
  } | null;
  /**
   * A verdict per stage, because a banner is three judgements and not one.
   *
   * The product can be right and the copy wrong; the copy can be right and
   * the layout broken. A single thumb averaged those into a number nobody
   * could act on, and the agents that produce them are separate — a verdict
   * that does not name a stage cannot improve any of their prompts.
   *
   * Binary on purpose. These feed prompts, and "what was wrong" is what a
   * prompt can absorb; "how wrong" is not. A down is also not a veto: being
   * unhappy with the copy and publishing anyway is a normal thing to do, so
   * nothing here moves the card or blocks anything.
   */
  verdicts: Verdicts;
  /**
   * How the product on the banner was reached, when the seed was in stock and
   * the run had to suggest rather than substitute. Null for a substitution,
   * where there is no customer to read: the job is to replace a known thing.
   */
  audience: {
    mode: 'substitute' | 'suggest';
    cluster: { id: string; label: string; by: string } | null;
    /** The picker's one-sentence reading of who this is. */
    profile: string | null;
    sections: Array<{ path: string; reason: string }>;
  } | null;
  /** Set when this job used a banner that already existed instead of making one. */
  reuse: {
    fromJobId: string;
    how: 'seed' | 'pick';
    /** Where the product sat in the matcher's list. Null for a seed hit. */
    rank: number | null;
    /** What the person reading the board needs to understand the swap. */
    note: string;
  } | null;
  /** Why a reuse did NOT happen, when one was looked for and rejected. */
  reuseRejected: string[];
  /** The person asked for a fresh banner on this one. */
  reuseOptOut: boolean;
}

/** Whether anyone has judged any part of this banner. */
export function anyVerdict(v: Verdicts): boolean {
  return VERDICT_STAGES.some((s) => v[s]);
}

/** True when every stage judged came back positive and at least one did. */
export function allGood(v: Verdicts): boolean {
  const given = VERDICT_STAGES.map((s) => v[s]).filter(Boolean);
  return given.length > 0 && given.every((x) => x!.value === 'up');
}

export function anyBad(v: Verdicts): boolean {
  return VERDICT_STAGES.some((s) => v[s]?.value === 'down');
}

export function kr(n: number): string {
  return `${n.toLocaleString('da-DK')} kr`;
}

export function stockLabel(band: string): string {
  const b = band.trim();
  if (!b || b === '0') return 'out of stock';
  return `${b} in stock`;
}
