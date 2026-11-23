/**
 * Copy and strategy for one product, in one language.
 *
 *   build facts  →  write copy  →  check copy  →  decide what else to show
 *
 * The first step is code and the last two are models, which is the same split
 * the rest of this project uses: what must be true is computed, what needs
 * judgement is asked. The check between them is code again, and it is the part
 * that makes "never invent a price" verifiable rather than merely instructed.
 *
 * The art director and the brand reviewer come after this and are not built
 * yet; this workflow ends with everything they will need.
 */
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { TagStore } from '../../store/index.js';
import { CostMeter, readUsage } from '../../cost/index.js';
import { RunEvents } from '../../events/index.js';
import { bannerLogger } from '../logger.js';
import { RpmThrottle, retryPlanFor, withRetry } from '../rpm.js';
import { hasApiKey } from '../agents/category-validator.js';
import {
  buildFacts, unsupportedNumbers, CTA_OPTIONS,
  type BannerFacts, type Badge, type Language,
} from '../../banner/facts.js';
import {
  COPYWRITER_FALLBACK_MODEL, COPYWRITER_MODEL, copyPrompt, copywriter,
  copywriterFallback, copywriterSchema, type CopyDraft,
} from '../agents/copywriter.js';
import {
  STRATEGIST_FALLBACK_MODEL, STRATEGIST_MODEL, strategist, strategistFallback,
  strategyPrompt, strategySchema,
} from '../agents/strategist.js';

/** The guide says 30–45 characters and never more than 60. 60 is the hard one. */
const HEADLINE_MAX = 60;
/** How many times the copywriter may be asked again after a failed check. */
const COPY_ATTEMPTS = 2;

export interface ChosenBadge {
  badge: Badge;
  reason: string;
}

export interface ComposeResult {
  runId: string;
  sku: string;
  language: Language;
  facts: BannerFacts;
  copy: CopyDraft | null;
  /** Checks that failed on the way, kept even when a later attempt passed. */
  copyIssues: string[];
  show: ChosenBadge[];
  skip: ChosenBadge[];
  finePrint: string | null;
  events: ReturnType<RunEvents['timeline']>;
  cost: ReturnType<CostMeter['summary']>;
}

interface RunContext {
  events: RunEvents;
  cost: CostMeter;
  facts: BannerFacts;
  copy: CopyDraft | null;
  copyIssues: string[];
  show: ChosenBadge[];
  skip: ChosenBadge[];
  finePrint: string | null;
  throttle: RpmThrottle;
  options: { verbose: boolean; webhookUrl?: string | undefined };
}

/** Same reasoning as the recommend workflow: run state does not belong in the payload. */
const contexts = new Map<string, RunContext>();

function ctx(runId: string): RunContext {
  const c = contexts.get(runId);
  if (!c) throw new Error(`no context for run ${runId}`);
  return c;
}

async function callModel<T>(
  c: RunContext,
  stage: string,
  primaryModel: string,
  primary: () => Promise<T>,
  fallbackModel: string,
  fallback: (() => Promise<T>) | null,
): Promise<{ result: T; model: string; ms: number }> {
  const began = Date.now();
  await c.throttle.take();
  try {
    const result = await withRetry(primary, {
      onRetry: (info) => c.events.emit('model.retry', { stage, model: primaryModel, ...info }),
    });
    return { result, model: primaryModel, ms: Date.now() - began };
  } catch (error) {
    if (!fallback || retryPlanFor(error, 0) === null) throw error;
    c.events.emit('model.fallback', {
      stage, from: primaryModel, to: fallbackModel,
      reason: error instanceof Error ? error.message.slice(0, 100) : String(error).slice(0, 100),
    });
    await c.throttle.take();
    const result = await withRetry(fallback, {
      onRetry: (info) => c.events.emit('model.retry', { stage, model: fallbackModel, ...info }),
    });
    return { result, model: fallbackModel, ms: Date.now() - began };
  }
}

/**
 * Everything about a draft that code can judge.
 *
 * None of these are matters of taste. A headline over the limit does not fit
 * the layout, an accent that is not in the headline cannot be highlighted, and
 * a number with no fact behind it is the one thing the brief forbids outright.
 */
function checkCopy(copy: CopyDraft, facts: BannerFacts): string[] {
  const issues: string[] = [];
  const headline = copy.headline.trim();

  if (!headline) issues.push('the headline is empty');
  if (headline.length > HEADLINE_MAX) {
    issues.push(`the headline is ${headline.length} characters, over the ${HEADLINE_MAX} limit`);
  }
  if (/[.!]$/.test(headline)) {
    issues.push('the headline ends in a full stop or exclamation mark');
  }
  if (!copy.support.trim()) issues.push('the supporting line is empty');

  /**
   * The button comes from a fixed list per language. Caught in testing: an
   * English banner came back with a Danish button, which reads as broken and
   * which no amount of "write in English" in the instructions prevented.
   */
  const cta = copy.cta.trim();
  const allowed = CTA_OPTIONS[facts.language];
  if (!cta) {
    issues.push('the call to action is empty');
  } else if (!allowed.includes(cta)) {
    issues.push(`the button "${cta}" is not one of: ${allowed.join(', ')}`);
  }

  const accent = copy.accent.trim();
  if (!accent) {
    issues.push('no accent phrase was given');
  } else if (!headline.includes(accent)) {
    issues.push(`the accent "${accent}" does not appear in the headline`);
  } else if (accent === headline) {
    issues.push('the accent is the whole headline, so nothing is set apart');
  }

  for (const [slot, text] of [
    ['headline', copy.headline],
    ['support', copy.support],
    ['cta', copy.cta],
  ] as const) {
    const bad = unsupportedNumbers(text, facts);
    if (bad.length) {
      issues.push(`the ${slot} contains ${bad.join(', ')}, which no fact supports`);
    }
  }

  return issues;
}

const inputSchema = z.object({
  sku: z.string(),
  language: z.enum(['da', 'sv', 'en']).default('da'),
  storeDir: z.string().optional(),
  verbose: z.boolean().default(true),
  webhookUrl: z.string().optional(),
});

const stateSchema = z.object({ runId: z.string(), done: z.boolean().default(false) });

const buildStep = createStep({
  id: 'build-facts',
  inputSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData, runId }) => {
    const store = new TagStore(inputData.storeDir).load();
    const product = store.get(inputData.sku);
    if (!product) throw new Error(`sku ${inputData.sku} is not in the store`);

    const events = new RunEvents(runId, {
      verbose: inputData.verbose,
      webhookUrl: inputData.webhookUrl,
      logger: bannerLogger,
    });
    const facts = buildFacts(product, inputData.language);

    contexts.set(runId, {
      events,
      cost: new CostMeter(),
      facts,
      copy: null,
      copyIssues: [],
      show: [],
      skip: [],
      finePrint: null,
      throttle: new RpmThrottle(),
      options: { verbose: inputData.verbose, webhookUrl: inputData.webhookUrl },
    });

    events.emit('run.started', { sku: inputData.sku, language: inputData.language });
    events.emit('facts.built', {
      name: product.name,
      price: product.price,
      available: facts.available.map((b) => b.kind),
      blocked: facts.blocked.map((b) => b.kind),
      restrictions: facts.restrictions.length,
    });

    /**
     * No image, no banner. Checking it here costs nothing and stops the run
     * before two model calls are spent on something that cannot be built.
     */
    if (!facts.image) {
      events.emit('run.failed', { reason: 'the product has no image' });
      return { runId, done: true };
    }
    return { runId, done: false };
  },
});

const writeStep = createStep({
  id: 'write-copy',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done) return inputData;
    if (!hasApiKey()) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');

    const base = copyPrompt(c.facts);
    const opts = { structuredOutput: { schema: copywriterSchema } };
    let lastIssues: string[] = [];

    for (let attempt = 0; attempt < COPY_ATTEMPTS; attempt++) {
      /**
       * A retry is not the same request again: the failed check goes back in,
       * so the second attempt is answering a more specific question than the
       * first. Asking again unchanged would mostly reproduce the same draft.
       */
      const prompt = lastIssues.length
        ? `${base}\n\nYour previous attempt was rejected:\n${lastIssues.map((i) => `- ${i}`).join('\n')}\n\nWrite it again, fixing exactly those problems.`
        : base;

      const { result, model, ms } = await callModel(
        c, 'write-copy', COPYWRITER_MODEL,
        () => copywriter.generate(prompt, opts),
        COPYWRITER_FALLBACK_MODEL,
        copywriterFallback ? () => copywriterFallback!.generate(prompt, opts) : null,
      );
      c.cost.record('write-copy', model, await readUsage(result), ms);

      const draft = (result as { object?: CopyDraft }).object;
      if (!draft) {
        lastIssues = ['the model returned nothing in the expected shape'];
        c.copyIssues.push(...lastIssues);
        continue;
      }

      const issues = checkCopy(draft, c.facts);
      if (!issues.length) {
        c.copy = draft;
        c.events.emit('copy.written', {
          attempt: attempt + 1,
          headline: draft.headline,
          length: draft.headline.length,
          accent: draft.accent,
          support: draft.support,
          cta: draft.cta,
        });
        return inputData;
      }

      lastIssues = issues;
      c.copyIssues.push(...issues);
      c.events.emit('copy.rejected', { attempt: attempt + 1, headline: draft.headline, issues });
      /** The last attempt's draft is kept: a flawed banner to look at beats nothing. */
      c.copy = draft;
    }

    return inputData;
  },
});

const strategyStep = createStep({
  id: 'decide-strategy',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done || !c.copy) return inputData;

    /**
     * Nothing to choose between, so nothing to ask. The call would cost a
     * request to be told the empty list is the only answer.
     */
    if (!c.facts.available.length) {
      c.cost.saved();
      c.events.emit('strategy.decided', { show: [], skip: [], reason: 'no facts available' });
      return inputData;
    }

    const prompt = strategyPrompt(c.facts, c.copy);
    const opts = { structuredOutput: { schema: strategySchema } };
    const { result, model, ms } = await callModel(
      c, 'decide-strategy', STRATEGIST_MODEL,
      () => strategist.generate(prompt, opts),
      STRATEGIST_FALLBACK_MODEL,
      strategistFallback ? () => strategistFallback!.generate(prompt, opts) : null,
    );
    c.cost.record('decide-strategy', model, await readUsage(result), ms);

    const answer = (result as { object?: z.infer<typeof strategySchema> }).object;
    if (!answer) {
      c.events.emit('strategy.decided', { show: [], skip: [], reason: 'no answer' });
      return inputData;
    }

    /**
     * An index outside the list is a wrong answer we can see. Dropping it is
     * safe in a way that guessing what was meant would not be.
     */
    let dropped = 0;
    const resolve = (rows: Array<{ item: number; reason: string }>): ChosenBadge[] => {
      const out: ChosenBadge[] = [];
      const taken = new Set<number>();
      for (const r of rows) {
        const badge = c.facts.available[r.item - 1];
        if (!badge || taken.has(r.item)) { dropped++; continue; }
        taken.add(r.item);
        out.push({ badge, reason: r.reason });
      }
      return out;
    };

    c.show = resolve(answer.show);
    const shown = new Set(c.show.map((s) => s.badge.kind));
    c.skip = resolve(answer.skip).filter((s) => !shown.has(s.badge.kind));
    c.finePrint = answer.finePrint?.trim() ? answer.finePrint.trim() : null;

    /**
     * A chosen badge with a condition must carry it. The strategist is asked
     * for the fine print, but whether it is needed is not a judgement call.
     */
    const needsCondition = c.show.filter((s) => s.badge.requires);
    if (needsCondition.length && !c.finePrint) {
      c.finePrint = needsCondition.map((s) => s.badge.requires).join(' · ');
      c.copyIssues.push(
        `the strategist chose ${needsCondition.map((s) => s.badge.kind).join(', ')} without the required condition, so it was added`,
      );
    }

    c.events.emit('strategy.decided', {
      show: c.show.map((s) => s.badge.kind),
      skip: c.skip.map((s) => s.badge.kind),
      finePrint: c.finePrint,
      droppedBadIndex: dropped,
    });
    return inputData;
  },
});

const finish = createStep({
  id: 'finish',
  inputSchema: stateSchema,
  outputSchema: z.custom<ComposeResult>(),
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    c.events.emit('run.completed', {
      wrote: Boolean(c.copy),
      issues: c.copyIssues.length,
      badges: c.show.length,
    });
    await c.events.flush();
    const out: ComposeResult = {
      runId: inputData.runId,
      sku: c.facts.sku,
      language: c.facts.language,
      facts: c.facts,
      copy: c.copy,
      copyIssues: c.copyIssues,
      show: c.show,
      skip: c.skip,
      finePrint: c.finePrint,
      events: c.events.timeline(),
      cost: c.cost.summary(),
    };
    contexts.delete(inputData.runId);
    return out;
  },
});

export const composeWorkflow = createWorkflow({
  id: 'compose',
  description: 'Writes the banner copy and decides which extras go on it',
  inputSchema,
  outputSchema: z.custom<ComposeResult>(),
})
  .then(buildStep)
  .then(writeStep)
  .then(strategyStep)
  .then(finish)
  .commit();
