/**
 * The feedback, read back as evidence.
 *
 * A banner run is written to `.cache/jobs/<id>.json` by the front end, and
 * that file already holds everything this loop needs: the brief the agents
 * worked from, what each of them produced, and the verdicts a person left on
 * the three stages. Nothing new has to be recorded.
 *
 * This module reads those files with a NARROW view of them on purpose. The
 * job shape belongs to the app and will keep growing; everything here would
 * break on every addition if it insisted on the whole type. What it needs is
 * small and stable.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { ArtDirectorBrief } from '../banner/brief.js';
import type { Language } from '../banner/facts.js';
import type { PromptId, PromptRecord } from '../prompts/index.js';

export const JOB_DIR = '.cache/jobs';

/** The three things a person judges, and which agent each one is about. */
export type VerdictStage = 'choice' | 'copy' | 'layout';

export interface Verdict {
  value: 'up' | 'down';
  at: string;
  by: string | null;
  /** `thumb` is a click; `redo` is someone paying to have it done again. */
  source: 'thumb' | 'redo';
}

export interface JobFile {
  id: string;
  createdAt: string;
  language: Language;
  pick: { sku: string; name: string } | null;
  brief: ArtDirectorBrief | null;
  headlineLines: string[];
  verdicts: Partial<Record<VerdictStage, Verdict>>;
  reuse: unknown;
}

/** Which stage's verdicts are evidence about which prompt. */
export const STAGE_OF: Record<PromptId, VerdictStage> = {
  copywriter: 'copy',
  strategist: 'copy',
  'art-director': 'layout',
};

export function readJobs(dir: string = JOB_DIR): JobFile[] {
  if (!existsSync(dir)) return [];
  const out: JobFile[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Partial<JobFile>;
      if (!raw.id) continue;
      out.push({
        id: raw.id,
        createdAt: raw.createdAt ?? '',
        language: (raw.language ?? 'da') as Language,
        pick: raw.pick ?? null,
        brief: raw.brief ?? null,
        headlineLines: raw.headlineLines ?? [],
        verdicts: raw.verdicts ?? {},
        reuse: raw.reuse ?? null,
      });
    } catch {
      /* a half-written file; it is not evidence of anything */
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface FeedbackCase {
  job: JobFile;
  verdict: Verdict;
}

export interface Evidence {
  id: PromptId;
  stage: VerdictStage;
  /** Everything judged since the active instructions took effect. */
  cases: FeedbackCase[];
  up: number;
  down: number;
  /** How many of the complaints were paid for with a rerun rather than a click. */
  redos: number;
  window: number;
  /** Enough to ask, and something to ask about. */
  ready: boolean;
  why: string;
}

/**
 * What this prompt has to go on.
 *
 * Two conditions, and they are different questions. The window is "is this
 * enough to generalise from" — one person disliking one banner says nothing
 * about the instructions. At least one complaint is "is there anything to
 * fix" — a run of approvals is a reason to leave the prompt alone, and
 * rewriting it anyway would be change for its own sake.
 */
export function evidenceFor(id: PromptId, record: PromptRecord, jobs: JobFile[]): Evidence {
  const stage = STAGE_OF[id];
  const since = record.since;

  const cases: FeedbackCase[] = [];
  for (const job of jobs) {
    const verdict = job.verdicts[stage];
    if (!verdict) continue;
    /** A verdict about instructions that are no longer live is spent. */
    if (verdict.at <= since) continue;
    /** Nothing to learn from a run with no brief: there is no output to read. */
    if (!job.brief) continue;
    cases.push({ job, verdict });
  }

  const down = cases.filter((c) => c.verdict.value === 'down').length;
  const up = cases.length - down;
  const redos = cases.filter((c) => c.verdict.source === 'redo').length;
  const window = record.window;

  let why: string;
  if (cases.length < window) why = `${cases.length} of ${window} verdicts since the last change`;
  else if (!down) why = `${cases.length} verdicts and not one complaint — nothing to fix`;
  else why = `${cases.length} verdicts, ${down} of them complaints`;

  return { id, stage, cases, up, down, redos, window, ready: cases.length >= window && down > 0, why };
}

/**
 * What the agent produced on a given run, as the thing being judged.
 *
 * One line per prompt, because the evidence a copywriter can learn from is
 * the copy and not the layout. Showing an agent judgements of someone else's
 * work is how a prompt acquires instructions about things it does not
 * control.
 */
export function outputOf(id: PromptId, job: JobFile): string {
  const brief = job.brief;
  if (!brief) return '(nothing was produced)';

  if (id === 'copywriter') {
    return [
      `headline: ${brief.copy.headline}`,
      `accent:   ${brief.copy.accent}`,
      `support:  ${brief.copy.support}`,
      `button:   ${brief.copy.cta}`,
    ].join('\n');
  }

  if (id === 'strategist') {
    const badges = brief.badges.length
      ? brief.badges.map((b) => `${b.kind} (${b.value}) — ${b.reason}`).join('\n          ')
      : 'none';
    return [
      `badges:   ${badges}`,
      `fine print: ${brief.finePrint ?? 'none'}`,
      `(the copy beside them: "${brief.copy.headline}" / "${brief.copy.support}")`,
    ].join('\n');
  }

  return [
    `headline, as broken into lines: ${job.headlineLines.map((l) => `"${l}"`).join(' / ') || '(not recorded)'}`,
    `layout: ${brief.design.layout} at type scale ${brief.design.typeScale}`,
  ].join('\n');
}

/** The product the banner was about, for context a prompt can be judged against. */
export function contextOf(job: JobFile): string {
  const brief = job.brief;
  if (!brief) return job.pick?.name ?? job.id;
  const badges = brief.badges.map((b) => b.kind).join(', ') || 'none';
  return `${brief.product.name} · ${brief.product.priceText} · facts shown: ${badges} · language: ${job.language}`;
}
