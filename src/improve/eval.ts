/**
 * The eval: does the candidate prompt produce better work than the live one?
 *
 * Both sides are generated NOW, from the same products and the same facts,
 * differing only in the instructions. That is twice the cheap calls, and it
 * is the only version of this that means anything: the output stored on an
 * old job was made from a feed that has since moved, so comparing a fresh
 * candidate against it would partly be measuring the price of a monitor.
 *
 * The cases are drawn from the feedback itself — the banners people
 * complained about, so the change can be seen to fix something, and the
 * banners people approved, so a fix that breaks what already worked is
 * caught. An eval made only of failures rewards overcorrection.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { CostMeter, readUsage } from '../cost/index.js';
import { RpmThrottle, withRetry } from '../mastra/rpm.js';
import { TagStore } from '../store/index.js';
import { buildFacts, CTA_OPTIONS, type BannerFacts } from '../banner/facts.js';
import {
  COPYWRITER_MODEL, copyPrompt, copywriterSchema, type CopyDraft,
} from '../mastra/agents/copywriter.js';
import { STRATEGIST_MODEL, strategyPrompt, strategySchema } from '../mastra/agents/strategist.js';
import {
  ART_DIRECTOR_MODEL, artDirectionPrompt, artDirectionSchema,
} from '../mastra/agents/art-director.js';
import { REVIEWER_MODEL, reviewPrompt, reviewer, reviewSchema } from '../mastra/agents/reviewer.js';
import type { EvalSummary, PromptId } from '../prompts/index.js';
import type { FeedbackCase } from './cases.js';

/** How many products the two prompts are compared on. */
export const EVAL_CASES = 6;
/** At most this many of them are banners somebody complained about. */
const MAX_COMPLAINTS = 4;

const MODEL_OF: Record<PromptId, string> = {
  copywriter: COPYWRITER_MODEL,
  strategist: STRATEGIST_MODEL,
  'art-director': ART_DIRECTOR_MODEL,
};

const WHAT_OF: Record<PromptId, string> = {
  copywriter: 'the banner copy — headline, the phrase set in green, supporting line and button',
  strategist: 'which facts earn a place on the banner beside the price, and in what order',
  'art-director': 'how the headline is broken into lines and how large the product is set',
};

export interface EvalCase {
  sku: string;
  product: string;
  language: string;
  /** Why this case is in the set. */
  from: 'complaint' | 'approval';
}

export interface CaseResult extends EvalCase {
  live: string;
  candidate: string;
  better: 'live' | 'candidate' | 'equal';
  because: string;
  broken: string[];
}

export interface EvalRun {
  summary: EvalSummary;
  results: CaseResult[];
  /** Why no comparison could be made, when none could. */
  skipped: string[];
}

/**
 * The products the two prompts are judged on.
 *
 * Complaints first and capped, approvals after. Deduplicated by product: two
 * verdicts on the same monitor are one test, and filling the set with them
 * would let one unhappy product decide a prompt.
 */
export function pickCases(cases: FeedbackCase[], limit = EVAL_CASES): EvalCase[] {
  const seen = new Set<string>();
  const take = (want: 'down' | 'up', max: number): EvalCase[] => {
    const out: EvalCase[] = [];
    for (const c of cases) {
      if (out.length >= max) break;
      if (c.verdict.value !== want) continue;
      const sku = c.job.brief?.product.sku;
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      out.push({
        sku,
        product: c.job.brief!.product.name,
        language: c.job.language,
        from: want === 'down' ? 'complaint' : 'approval',
      });
    }
    return out;
  };

  const complaints = take('down', Math.min(MAX_COMPLAINTS, limit));
  const approvals = take('up', limit - complaints.length);
  return [...complaints, ...approvals];
}

/** The complaints, as sentences the reviewer can check a candidate against. */
export function complaintsFrom(cases: FeedbackCase[], id: PromptId): string[] {
  const out: string[] = [];
  for (const c of cases) {
    if (c.verdict.value !== 'down' || !c.job.brief) continue;
    const what =
      id === 'copywriter' ? `"${c.job.brief.copy.headline}" / "${c.job.brief.copy.support}"`
      : id === 'strategist' ? `badges: ${c.job.brief.badges.map((b) => b.kind).join(', ') || 'none'}`
      : `lines: ${c.job.headlineLines.join(' / ')}`;
    const how = c.verdict.source === 'redo' ? 'rejected and paid to be redone' : 'rejected';
    out.push(`${c.job.brief.product.name} — ${what} — ${how}`);
  }
  return out;
}

/** One agent, built on the spot around a set of instructions nobody promoted. */
function agentWith(id: PromptId, instructions: string, tag: string): Agent {
  return new Agent({
    id: `${id}-${tag}`,
    name: `${id}-${tag}`,
    instructions,
    model: google(MODEL_OF[id]),
  });
}

/**
 * Runs the stage once and renders what it produced as text.
 *
 * Text, because that is what the reviewer reads and what a person reads on
 * the screen afterwards. The structured answer is already validated by the
 * schema; what matters here is the comparison.
 */
async function produce(
  id: PromptId,
  agent: Agent,
  facts: BannerFacts,
  job: FeedbackCase['job'],
  meter: CostMeter,
  throttle: RpmThrottle,
  tag: string,
): Promise<string> {
  const run = async <T>(prompt: string, schema: z.ZodType<T>): Promise<T | null> => {
    await throttle.take();
    const began = Date.now();
    const result = await withRetry(() => agent.generate(prompt, { structuredOutput: { schema } }));
    meter.record(`${id}:${tag}`, MODEL_OF[id], await readUsage(result), Date.now() - began);
    return ((result as { object?: T }).object ?? null);
  };

  if (id === 'copywriter') {
    const copy = await run(copyPrompt(facts), copywriterSchema);
    if (!copy) return '(no answer)';
    return [
      `headline: ${copy.headline}`,
      `accent:   ${copy.accent}`,
      `support:  ${copy.support}`,
      `button:   ${copy.cta}`,
    ].join('\n');
  }

  if (id === 'strategist') {
    /**
     * The same copy on both sides, taken from the run being replayed: the
     * strategist's job is to choose beside a given headline, and letting the
     * copy differ would make the comparison about the copywriter.
     */
    const copy: CopyDraft = {
      ...(job.brief!.copy as Omit<CopyDraft, 'rationale'>),
      rationale: '',
    };
    const answer = await run(strategyPrompt(facts, copy), strategySchema);
    if (!answer) return '(no answer)';
    const name = (i: number) => facts.available[i - 1];
    const show = answer.show
      .map((s) => {
        const badge = name(s.item);
        return badge ? `${badge.kind} (${badge.value}) — ${s.reason}` : null;
      })
      .filter(Boolean);
    return [
      `shown, best first: ${show.length ? show.join('\n                   ') : 'nothing'}`,
      `fine print: ${answer.finePrint ?? 'none'}`,
    ].join('\n');
  }

  const direction = await run(artDirectionPrompt(job.brief!), artDirectionSchema);
  if (!direction) return '(no answer)';
  return [
    `headline in lines: ${direction.headlineLines.map((l) => `"${l}"`).join(' / ')}`,
    `product size: ${direction.productScale}`,
    `because: ${direction.rationale}`,
  ].join('\n');
}

export interface EvalInput {
  id: PromptId;
  /** The instructions in force today. */
  live: string;
  candidate: string;
  cases: FeedbackCase[];
  limit?: number;
  onProgress?: (line: string) => void;
}

/**
 * Compares the two prompts and says what the reviewer concluded.
 *
 * The A/B is shuffled per case and the reviewer is never told which side is
 * which. The mapping stays here.
 */
export async function runEval(input: EvalInput): Promise<EvalRun> {
  const { id, live, candidate } = input;
  const meter = new CostMeter();
  const throttle = new RpmThrottle();
  const store = new TagStore().load();
  const picked = pickCases(input.cases, input.limit ?? EVAL_CASES);
  const complaints = complaintsFrom(input.cases, id);

  const liveAgent = agentWith(id, live, 'live');
  const candidateAgent = agentWith(id, candidate, 'candidate');

  const results: CaseResult[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];

  for (const c of picked) {
    const product = store.get(c.sku);
    const job = input.cases.find((x) => x.job.brief?.product.sku === c.sku)?.job;
    if (!product || !job?.brief) {
      skipped.push(`${c.product}: no longer in the feed`);
      continue;
    }
    const facts = buildFacts(product, job.language);

    input.onProgress?.(`${c.product} (${c.from})`);
    let liveOut: string;
    let candidateOut: string;
    try {
      liveOut = await produce(id, liveAgent, facts, job, meter, throttle, 'live');
      candidateOut = await produce(id, candidateAgent, facts, job, meter, throttle, 'candidate');
    } catch (error) {
      skipped.push(`${c.product}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    /** Coin flip per case, so position bias cannot look like a preference. */
    const candidateFirst = Math.random() < 0.5;
    const prompt = reviewPrompt({
      what: WHAT_OF[id],
      product: `${product.name} · ${product.price} kr`,
      facts: facts.available.map((b) => `${b.kind}: ${b.value}`),
      buttons: id === 'copywriter' ? CTA_OPTIONS[job.language] : [],
      complaints,
      first: candidateFirst ? candidateOut : liveOut,
      second: candidateFirst ? liveOut : candidateOut,
    });

    await throttle.take();
    const began = Date.now();
    const answer = await withRetry(() =>
      reviewer.generate(prompt, { structuredOutput: { schema: reviewSchema } }),
    );
    meter.record('review', REVIEWER_MODEL, await readUsage(answer), Date.now() - began);
    const verdict = (answer as { object?: z.infer<typeof reviewSchema> }).object;
    if (!verdict) {
      skipped.push(`${c.product}: the reviewer gave no answer`);
      continue;
    }

    const better: CaseResult['better'] =
      verdict.better === 'equal'
        ? 'equal'
        : (verdict.better === 'first') === candidateFirst
          ? 'candidate'
          : 'live';

    /**
     * The reviewer says "first" or "second"; which of those is the candidate
     * is only known here, so its rule-break lines are relabelled before
     * anyone reads them.
     */
    const broken = verdict.broken.map((b) =>
      b
        .replace(/\bfirst\b/gi, candidateFirst ? 'the candidate' : 'the live prompt')
        .replace(/\bsecond\b/gi, candidateFirst ? 'the live prompt' : 'the candidate'),
    );

    results.push({ ...c, live: liveOut, candidate: candidateOut, better, because: verdict.because, broken });
    notes.push(`${c.product}: ${better} — ${verdict.because}`);
  }

  const wins = results.filter((r) => r.better === 'candidate').length;
  const losses = results.filter((r) => r.better === 'live').length;
  const ties = results.filter((r) => r.better === 'equal').length;
  /** Only a break attributed to the candidate counts against it. */
  const broke = results.filter((r) => r.broken.some((b) => /candidate/i.test(b))).length;

  const summary: EvalSummary = {
    wins,
    losses,
    ties,
    broke,
    cases: results.length,
    model: REVIEWER_MODEL,
    at: new Date().toISOString(),
    notes,
    usd: meter.summary().usd,
  };

  return { summary, results, skipped };
}

/**
 * The bar a candidate has to clear.
 *
 * It has to win more than it loses, and it has to break nothing. A tie-heavy
 * result is a failure to improve, not a licence to change the prompt: the
 * change cost money and bought nothing, and every rewrite risks something the
 * eval did not sample.
 */
export function passed(summary: EvalSummary): boolean {
  return summary.cases > 0 && summary.broke === 0 && summary.wins > summary.losses;
}

export function verdictLine(summary: EvalSummary): string {
  const bits = [`${summary.wins} better`, `${summary.losses} worse`, `${summary.ties} equal`];
  if (summary.broke) bits.push(`${summary.broke} broke a rule`);
  return `${bits.join(', ')} over ${summary.cases} products`;
}
