/**
 * The loop.
 *
 *   enough feedback?  →  rewrite the prompt  →  compare the two on real
 *   products  →  promote, or roll back and wait for more evidence
 *
 * The shape of it is a ratchet: a change only sticks if something that did
 * not write it judges it better, and a change that fails makes the next
 * attempt wait longer. Without the second half the loop would propose a
 * rewrite every time the window filled and keep paying a pro model to walk
 * randomly around the prompt it started from.
 *
 * Nothing here runs on its own. It is called from the CLI or from the
 * improvement screen, because it spends money on a model and that should be
 * somebody's decision, not a timer's.
 */
import { CostMeter, readUsage } from '../cost/index.js';
import { RpmThrottle, withRetry } from '../mastra/rpm.js';
import {
  IMPROVER_MODEL, improver, improverPrompt, improverSchema, type ImproverCase,
} from '../mastra/agents/improver.js';
import {
  activeRevision, addCandidate, attachEval, candidateOf, loadPrompts, promote, recordOf,
  reject, savePrompts, type EvalSummary, type PromptBook, type PromptId,
} from '../prompts/index.js';
import { PROMPT_META } from '../prompts/registry.js';
import { contextOf, evidenceFor, outputOf, readJobs, type Evidence } from './cases.js';
import { lessonLine, markUsed, unusedFor, type Lesson } from './lessons.js';
import { passed, runEval, verdictLine, type CaseResult } from './eval.js';

export type Outcome =
  | 'not-ready'
  | 'declined'
  | 'unusable'
  | 'awaiting-human'
  | 'promoted'
  | 'rejected'
  | 'failed';

export interface ImproveResult {
  id: PromptId;
  outcome: Outcome;
  /** One line a person can read without opening anything. */
  headline: string;
  evidence: Evidence;
  note: string;
  changes: string[];
  version: number | null;
  evaluation: EvalSummary | null;
  cases: CaseResult[];
  /** What this run of the loop cost, improver and eval together. */
  usd: number | null;
  calls: number;
}

export interface ImproveOptions {
  /** Ask even when the window is not full. For trying the loop out. */
  force?: boolean;
  /** Skip the comparison. The candidate then always waits for a person. */
  skipEval?: boolean;
  /** Override the book's setting for this run. */
  approval?: 'auto' | 'human';
  onProgress?: (line: string) => void;
}

/**
 * A rewrite that is a fraction of the original, or several times it, is not
 * an improvement to instructions — it is a different document, and most
 * likely the model answering a different question. Cheap to check, and it
 * catches the failure that would otherwise be caught by a person wondering
 * why every banner changed.
 */
const MIN_RATIO = 0.4;
const MAX_RATIO = 2.5;

export async function improvePrompt(
  id: PromptId,
  options: ImproveOptions = {},
): Promise<ImproveResult> {
  const say = options.onProgress ?? (() => {});
  const meta = PROMPT_META[id];
  const meter = new CostMeter();
  const throttle = new RpmThrottle();

  let book = loadPrompts();
  const record = recordOf(book, id);
  const jobs = readJobs();
  const evidence = evidenceFor(id, record, jobs);

  /**
   * Finished A/B tests, which are evidence of a different kind.
   *
   * A verdict is one person's opinion of one banner; a decided test is
   * thousands of strangers choosing between two. So a single unread test is
   * enough on its own to be worth a rewrite, where a single thumb never is —
   * and the window does not apply to it.
   */
  const lessons: Lesson[] = unusedFor(id);

  const base = {
    id,
    evidence,
    note: '',
    changes: [] as string[],
    version: null as number | null,
    evaluation: null as EvalSummary | null,
    cases: [] as CaseResult[],
    usd: null as number | null,
    calls: 0,
  };

  if (!evidence.ready && !lessons.length && !options.force) {
    return { ...base, outcome: 'not-ready', headline: evidence.why };
  }

  /* ---------------------------------------------------- 1. rewrite it */

  const live = activeRevision(book, id);
  const liveText = live?.text ?? meta.baseline;

  const cases: ImproverCase[] = evidence.cases.map((c) => ({
    context: contextOf(c.job),
    output: outputOf(id, c.job),
    verdict: c.verdict.value === 'up' ? 'approved' : 'rejected',
    weight: c.verdict.source === 'redo' ? 'a paid rerun' : 'a click',
  }));

  say(
    `asking ${IMPROVER_MODEL} to read ${cases.length} judged banners`
    + (lessons.length ? ` and ${lessons.length} finished A/B test${lessons.length === 1 ? '' : 's'}` : ''),
  );
  const prompt = improverPrompt({
    agent: meta.label,
    role: meta.role,
    baseline: meta.baseline,
    current: live ? liveText : null,
    cases,
    measured: lessons.map(lessonLine),
  });

  let answer;
  try {
    await throttle.take();
    const began = Date.now();
    const result = await withRetry(() =>
      improver.generate(prompt, { structuredOutput: { schema: improverSchema } }),
    );
    meter.record('improve', IMPROVER_MODEL, await readUsage(result), Date.now() - began);
    answer = (result as { object?: import('zod').infer<typeof improverSchema> }).object ?? null;
  } catch (error) {
    const spend = meter.summary();
    return {
      ...base,
      outcome: 'failed',
      headline: error instanceof Error ? error.message : String(error),
      usd: spend.usd,
      calls: spend.calls,
    };
  }

  /** Read once. Re-reading them next time would buy the same answer again. */
  markUsed(lessons.map((l) => l.id));

  const spendAfterImprover = meter.summary();
  if (!answer) {
    return { ...base, outcome: 'failed', headline: 'the improver gave no answer', usd: spendAfterImprover.usd, calls: spendAfterImprover.calls };
  }

  const text = answer.instructions.trim();
  const unchanged = text === liveText.trim();

  /**
   * Declining is a result, not a failure, and the evidence is spent either
   * way: it has been read and it did not imply a change, so reading it again
   * next time would buy the same answer at the same price. The window does
   * NOT grow — nothing went wrong, and making the next look rarer would
   * punish the agent for being honest.
   */
  if (answer.declined || unchanged) {
    book = {
      ...book,
      records: { ...book.records, [id]: { ...record, since: new Date().toISOString() } },
    };
    savePrompts(book);
    return {
      ...base,
      outcome: 'declined',
      headline: 'no change: the feedback does not generalise',
      note: answer.note,
      usd: spendAfterImprover.usd,
      calls: spendAfterImprover.calls,
    };
  }

  book = addCandidate(book, id, {
    text,
    by: `improver:${IMPROVER_MODEL}`,
    note: answer.note,
    from: {
      verdicts: evidence.cases.length,
      down: evidence.down,
      jobIds: evidence.cases.map((c) => c.job.id),
    },
  });
  book = savePrompts(book);
  const candidate = candidateOf(book, id)!;
  say(`candidate v${candidate.version} written`);

  /**
   * It is recorded before it is checked, so a bad rewrite leaves a trace
   * rather than vanishing: "the improver returned a tenth of the prompt" is
   * something a person needs to be able to see on the record.
   */
  const ratio = text.length / liveText.length;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
    book = reject(book, id, candidate.version, 'system');
    savePrompts(book);
    return {
      ...base,
      outcome: 'unusable',
      headline: `the rewrite is ${Math.round(ratio * 100)}% of the length of the instructions it was asked to improve, which is a different document and not an edit`,
      note: answer.note,
      changes: answer.changes,
      version: candidate.version,
      usd: spendAfterImprover.usd,
      calls: spendAfterImprover.calls,
    };
  }

  /* ------------------------------------------------------ 2. judge it */

  if (options.skipEval) {
    const spend = meter.summary();
    return {
      ...base,
      outcome: 'awaiting-human',
      headline: `candidate v${candidate.version} is waiting for a person; it was not evaluated`,
      note: answer.note,
      changes: answer.changes,
      version: candidate.version,
      usd: spend.usd,
      calls: spend.calls,
    };
  }

  say('comparing the two prompts on real products');
  const run = await runEval({
    id,
    live: liveText,
    candidate: text,
    cases: evidence.cases,
    onProgress: (line) => say(`  ${line}`),
  });

  book = attachEval(book, id, candidate.version, run.summary);
  book = savePrompts(book);

  const totalUsd =
    run.summary.usd === null || meter.summary().usd === null
      ? null
      : (meter.summary().usd ?? 0) + (run.summary.usd ?? 0);
  const calls = meter.summary().calls + run.summary.cases * 3;

  /* --------------------------------------------- 3. promote or go back */

  if (!passed(run.summary)) {
    book = reject(book, id, candidate.version, 'reviewer');
    savePrompts(book);
    const widened = recordOf(loadPrompts(), id).window;
    return {
      ...base,
      outcome: 'rejected',
      headline: `rolled back: ${verdictLine(run.summary)}. The next attempt waits for ${widened} verdicts.`,
      note: answer.note,
      changes: answer.changes,
      version: candidate.version,
      evaluation: run.summary,
      cases: run.results,
      usd: totalUsd,
      calls,
    };
  }

  const approval = options.approval ?? book.approval;
  if (approval === 'human') {
    return {
      ...base,
      outcome: 'awaiting-human',
      headline: `the reviewer prefers v${candidate.version}: ${verdictLine(run.summary)}. Waiting for a person to promote it.`,
      note: answer.note,
      changes: answer.changes,
      version: candidate.version,
      evaluation: run.summary,
      cases: run.results,
      usd: totalUsd,
      calls,
    };
  }

  book = promote(book, id, candidate.version, 'reviewer');
  savePrompts(book);
  return {
    ...base,
    outcome: 'promoted',
    headline: `v${candidate.version} is live: ${verdictLine(run.summary)}`,
    note: answer.note,
    changes: answer.changes,
    version: candidate.version,
    evaluation: run.summary,
    cases: run.results,
    usd: totalUsd,
    calls,
  };
}

/** What the screen and the CLI show without spending anything. */
export function statusOf(book: PromptBook = loadPrompts()) {
  const jobs = readJobs();
  return (Object.keys(PROMPT_META) as PromptId[]).map((id) => {
    const record = recordOf(book, id);
    return {
      meta: PROMPT_META[id],
      record,
      active: activeRevision(book, id),
      candidate: candidateOf(book, id),
      evidence: evidenceFor(id, record, jobs),
    };
  });
}
