/**
 * The agents' instructions, versioned.
 *
 * Every tunable agent has a BASELINE written in its own source file. That
 * baseline is the thing under version control, the thing a person reads to
 * understand what the agent is for, and the thing we can always return to.
 * It never changes here.
 *
 * On top of it sits a stack of revisions. A revision is a complete
 * replacement of the instructions, written by the improver agent from
 * feedback or by a person, and it carries the evidence it came from and the
 * eval that judged it. The agent reads the active one at call time, so
 * promoting a revision changes the next banner without a deploy.
 *
 * Two things are kept deliberately:
 *
 *   - Nothing is deleted. A rejected revision stays in the file with its eval
 *     attached, because "we tried this and it was worse" is the most useful
 *     thing this loop produces and it is also the only defence against
 *     proposing the same change again next month.
 *
 *   - The window grows when a revision is rolled back. A rollback means the
 *     evidence was not enough to see the problem clearly, and the honest
 *     response to that is to wait for more of it rather than to try again
 *     immediately with the same amount.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

export const PROMPT_IDS = ['copywriter', 'strategist', 'art-director'] as const;
export type PromptId = (typeof PROMPT_IDS)[number];

export function isPromptId(v: unknown): v is PromptId {
  return typeof v === 'string' && (PROMPT_IDS as readonly string[]).includes(v);
}

/** What the reviewer concluded about a candidate, over the eval set. */
export interface EvalSummary {
  /** Cases where the reviewer preferred the candidate. */
  wins: number;
  losses: number;
  ties: number;
  /** Cases where the candidate broke a rule the baseline keeps. Fatal. */
  broke: number;
  cases: number;
  model: string;
  at: string;
  /** One line per case, so a person can disagree with the reviewer. */
  notes: string[];
  usd: number | null;
}

export type RevisionState = 'candidate' | 'active' | 'rejected' | 'superseded';

export interface PromptRevision {
  version: number;
  /** The complete instructions. Not a patch: a prompt is read whole. */
  text: string;
  at: string;
  /** `improver:<model>`, `human:<who>`. */
  by: string;
  /** What this changes and why, in the improver's or the person's words. */
  note: string;
  /** The feedback that justified it. */
  from: { verdicts: number; down: number; jobIds: string[] } | null;
  evaluation: EvalSummary | null;
  state: RevisionState;
  /** Set when a person promoted or rejected it by hand. */
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface PromptRecord {
  id: PromptId;
  /**
   * How many verdicts this agent's work needs before the improver is called.
   * Grows on every rollback.
   */
  window: number;
  /**
   * Verdicts from before this moment are spent: they are about the version
   * that was replaced. Set whenever the active instructions change.
   */
  since: string;
  revisions: PromptRevision[];
}

export interface PromptBook {
  version: number;
  savedAt: string;
  /**
   * Whether a candidate the reviewer approved may go live on its own.
   *
   * `human` is the cautious setting: everything waits on the approval screen.
   * `auto` is the loop the design asks for, and a candidate the reviewer
   * rejects still never goes live under either.
   */
  approval: 'auto' | 'human';
  records: Record<string, PromptRecord>;
}

const PATH = '.cache/prompts.json';

/** The first window. Small enough to see the loop work, large enough to mean something. */
export const FIRST_WINDOW = 8;

/** How much longer to wait after a rollback. */
export const WINDOW_GROWTH = 1.5;

export function emptyRecord(id: PromptId): PromptRecord {
  return { id, window: FIRST_WINDOW, since: new Date(0).toISOString(), revisions: [] };
}

export function emptyBook(): PromptBook {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    approval: 'human',
    records: Object.fromEntries(PROMPT_IDS.map((id) => [id, emptyRecord(id)])),
  };
}

/**
 * Read with a cache, because every model call asks for its instructions.
 *
 * The cache is keyed on the file's modification time, so a promotion from the
 * screen is picked up by the next banner without a restart, and a thousand
 * banners in a row read the file once.
 */
let cached: { mtimeMs: number; book: PromptBook } | null = null;

export function loadPrompts(): PromptBook {
  try {
    if (!existsSync(PATH)) return emptyBook();
    const mtimeMs = statSync(PATH).mtimeMs;
    if (cached && cached.mtimeMs === mtimeMs) return cached.book;
    const book = JSON.parse(readFileSync(PATH, 'utf8')) as PromptBook;
    /** A file written before an id existed must not make that agent unreadable. */
    for (const id of PROMPT_IDS) book.records[id] ??= emptyRecord(id);
    book.approval = book.approval === 'auto' ? 'auto' : 'human';
    cached = { mtimeMs, book };
    return book;
  } catch {
    /* A broken file must never stop a banner: the baselines are a fine answer. */
    return emptyBook();
  }
}

export function savePrompts(book: PromptBook): PromptBook {
  const next: PromptBook = { ...book, version: book.version + 1, savedAt: new Date().toISOString() };
  mkdirSync('.cache', { recursive: true });
  writeFileSync(PATH, JSON.stringify(next, null, 2));
  cached = { mtimeMs: statSync(PATH).mtimeMs, book: next };
  return next;
}

export function recordOf(book: PromptBook, id: PromptId): PromptRecord {
  return book.records[id] ?? emptyRecord(id);
}

export function activeRevision(book: PromptBook, id: PromptId): PromptRevision | null {
  const revisions = recordOf(book, id).revisions;
  return [...revisions].reverse().find((r) => r.state === 'active') ?? null;
}

export function candidateOf(book: PromptBook, id: PromptId): PromptRevision | null {
  const revisions = recordOf(book, id).revisions;
  return [...revisions].reverse().find((r) => r.state === 'candidate') ?? null;
}

/**
 * What the agent actually runs with.
 *
 * The baseline is passed in by the agent itself rather than looked up, which
 * keeps this module from importing every agent and keeps the baseline where a
 * reader will find it: next to the agent it belongs to.
 */
export function activeInstructions(id: PromptId, baseline: string): string {
  const active = activeRevision(loadPrompts(), id);
  return active?.text.trim() ? active.text : baseline;
}

/** The next version number for this prompt, baseline counting as 1. */
function nextVersion(record: PromptRecord): number {
  return record.revisions.reduce((max, r) => Math.max(max, r.version), 1) + 1;
}

export interface CandidateInput {
  text: string;
  by: string;
  note: string;
  from: PromptRevision['from'];
}

/**
 * Puts a candidate on the record. It is not live: a candidate is a proposal,
 * and something still has to judge it.
 */
export function addCandidate(book: PromptBook, id: PromptId, input: CandidateInput): PromptBook {
  const record = recordOf(book, id);
  /** Only one proposal at a time, or the screen becomes a queue nobody reads. */
  const revisions = record.revisions.map((r) =>
    r.state === 'candidate' ? { ...r, state: 'superseded' as const } : r,
  );
  revisions.push({
    version: nextVersion(record),
    text: input.text,
    at: new Date().toISOString(),
    by: input.by,
    note: input.note,
    from: input.from,
    evaluation: null,
    state: 'candidate',
    decidedBy: null,
    decidedAt: null,
  });
  return { ...book, records: { ...book.records, [id]: { ...record, revisions } } };
}

export function attachEval(
  book: PromptBook,
  id: PromptId,
  version: number,
  evaluation: EvalSummary,
): PromptBook {
  const record = recordOf(book, id);
  const revisions = record.revisions.map((r) => (r.version === version ? { ...r, evaluation } : r));
  return { ...book, records: { ...book.records, [id]: { ...record, revisions } } };
}

/**
 * The candidate goes live.
 *
 * Whatever was active becomes superseded, and the clock on the evidence
 * restarts: verdicts collected about the old instructions say nothing about
 * these, and counting them towards the next revision would be the loop
 * marking its own homework.
 */
export function promote(book: PromptBook, id: PromptId, version: number, by: string): PromptBook {
  const record = recordOf(book, id);
  const revisions = record.revisions.map((r) => {
    if (r.version === version) {
      return { ...r, state: 'active' as const, decidedBy: by, decidedAt: new Date().toISOString() };
    }
    if (r.state === 'active') return { ...r, state: 'superseded' as const };
    return r;
  });
  return {
    ...book,
    records: {
      ...book.records,
      [id]: { ...record, revisions, since: new Date().toISOString() },
    },
  };
}

/**
 * The candidate is refused, and the next attempt has to wait longer.
 *
 * The window growing is the point. A revision that the reviewer judged no
 * better was written from feedback that did not say enough; asking the same
 * question again on the same amount of evidence would produce the same
 * quality of answer and spend the money again to find out.
 */
export function reject(book: PromptBook, id: PromptId, version: number, by: string): PromptBook {
  const record = recordOf(book, id);
  const revisions = record.revisions.map((r) =>
    r.version === version
      ? { ...r, state: 'rejected' as const, decidedBy: by, decidedAt: new Date().toISOString() }
      : r,
  );
  return {
    ...book,
    records: {
      ...book.records,
      [id]: {
        ...record,
        revisions,
        window: Math.ceil(record.window * WINDOW_GROWTH),
        /**
         * The evidence is spent either way. It was read, it produced a
         * proposal, and the proposal lost; reading it again next time would
         * reproduce the same proposal.
         */
        since: new Date().toISOString(),
      },
    },
  };
}

/**
 * Back to the instructions that were live before.
 *
 * Used when a promoted revision turns out badly in the real world rather
 * than in the eval — the eval is a sample and the shop is not.
 */
export function rollBack(book: PromptBook, id: PromptId, by: string): PromptBook {
  const record = recordOf(book, id);
  const active = activeRevision(book, id);
  if (!active) return book;

  const earlier = [...record.revisions]
    .filter((r) => r.version < active.version && (r.state === 'superseded' || r.state === 'active'))
    .sort((a, b) => b.version - a.version)[0];

  const revisions = record.revisions.map((r) => {
    if (r.version === active.version) {
      return { ...r, state: 'rejected' as const, decidedBy: by, decidedAt: new Date().toISOString() };
    }
    if (earlier && r.version === earlier.version) return { ...r, state: 'active' as const };
    return r;
  });

  return {
    ...book,
    records: {
      ...book.records,
      [id]: {
        ...record,
        revisions,
        window: Math.ceil(record.window * WINDOW_GROWTH),
        since: new Date().toISOString(),
      },
    },
  };
}
