/**
 * The art direction pass: ask for the layout judgements, check them, render.
 *
 * It is a workflow rather than a function call in the CLI so that it reports
 * cost and stages like every other paid step, and so a front end can drive it
 * the same way it drives the other two.
 */
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { CostMeter, readUsage } from '../../cost/index.js';
import { RunEvents } from '../../events/index.js';
import { bannerLogger } from '../logger.js';
import { RpmThrottle, retryPlanFor, withRetry } from '../rpm.js';
import { hasApiKey } from '../agents/category-validator.js';
import type { ArtDirectorBrief } from '../../banner/brief.js';
import { renderBanner, type RenderResult } from '../../banner/render.js';
import {
  ART_DIRECTOR_FALLBACK_MODEL, ART_DIRECTOR_MODEL, artDirectionPrompt,
  artDirectionSchema, artDirector, artDirectorFallback, headlineMismatch,
  type ArtDirection,
} from '../agents/art-director.js';

/** How many times a rejected layout is sent back with the reason. */
const ATTEMPTS = 2;

export interface ArtDirectResult {
  runId: string;
  direction: ArtDirection;
  /** Checks that failed on the way, kept even when a later attempt passed. */
  issues: string[];
  render: RenderResult | null;
  renderError: string | null;
  cost: ReturnType<CostMeter['summary']>;
  events: ReturnType<RunEvents['timeline']>;
}

interface RunContext {
  events: RunEvents;
  cost: CostMeter;
  throttle: RpmThrottle;
  brief: ArtDirectorBrief;
  direction: ArtDirection;
  issues: string[];
  render: RenderResult | null;
  renderError: string | null;
  outDir: string;
  name: string;
}

const contexts = new Map<string, RunContext>();

function ctx(runId: string): RunContext {
  const c = contexts.get(runId);
  if (!c) throw new Error(`no context for run ${runId}`);
  return c;
}

/**
 * The layout used when the model cannot produce a valid one.
 *
 * Breaking at the accent is the one split that is always defensible, and a
 * plain large product is never wrong enough to be worth failing the run over.
 */
function fallbackDirection(brief: ArtDirectorBrief): ArtDirection {
  const { headline, accent } = brief.copy;
  const at = accent ? headline.indexOf(accent) : -1;
  const lines =
    at > 0
      ? [headline.slice(0, at).trim(), headline.slice(at).trim()].filter(Boolean)
      : [headline];
  return {
    headlineLines: lines,
    productScale: 'large',
    rationale: 'fallback layout: the model did not return a usable one',
  };
}

/** Everything about a layout that code can judge. */
function checkDirection(d: ArtDirection, brief: ArtDirectorBrief): string[] {
  const issues: string[] = [];
  const mismatch = headlineMismatch(d.headlineLines, brief.copy.headline);
  if (mismatch) issues.push(mismatch);
  if (d.headlineLines.some((l) => !l.trim())) issues.push('one of the lines is empty');

  const accent = brief.copy.accent.trim().toLowerCase();
  if (accent && !d.headlineLines.some((l) => l.toLowerCase().includes(accent))) {
    issues.push(`the accent "${brief.copy.accent}" is split across lines instead of sitting inside one`);
  }

  /**
   * A one-word line next to much longer ones is the break the instructions
   * forbid, and the first real layout produced exactly that. Checking it is
   * cheap and the retry carries the reason, so the model gets a second go at
   * the same sentence rather than the same mistake.
   */
  if (d.headlineLines.length > 1) {
    const lengths = d.headlineLines.map((l) => l.trim().length);
    const longest = Math.max(...lengths);
    d.headlineLines.forEach((l, i) => {
      const words = l.trim().split(/\s+/).filter(Boolean).length;
      if (words === 1 && lengths[i]! < longest * 0.5) {
        issues.push(`line ${i + 1} is the single word "${l.trim()}", stranded next to much longer lines`);
      }
    });
  }
  return issues;
}

const inputSchema = z.object({
  brief: z.custom<ArtDirectorBrief>(),
  outDir: z.string().default('.cache/banners'),
  name: z.string(),
  verbose: z.boolean().default(true),
  webhookUrl: z.string().optional(),
  /** Produce only the layout decision, no PNG. */
  skipRender: z.boolean().default(false),
});

const stateSchema = z.object({ runId: z.string(), skipRender: z.boolean() });

const direct = createStep({
  id: 'art-direction',
  inputSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData, runId }) => {
    if (!hasApiKey()) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    const events = new RunEvents(runId, {
      verbose: inputData.verbose,
      webhookUrl: inputData.webhookUrl,
      logger: bannerLogger,
    });
    const c: RunContext = {
      events,
      cost: new CostMeter(),
      throttle: new RpmThrottle(),
      brief: inputData.brief,
      direction: fallbackDirection(inputData.brief),
      issues: [],
      render: null,
      renderError: null,
      outDir: inputData.outDir,
      name: inputData.name,
    };
    contexts.set(runId, c);
    events.emit('run.started', { sku: c.brief.product.sku, language: c.brief.language });

    const base = artDirectionPrompt(c.brief);
    const opts = { structuredOutput: { schema: artDirectionSchema } };
    let last: string[] = [];

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const prompt = last.length
        ? `${base}\n\nYour previous layout was rejected:\n${last.map((i) => `- ${i}`).join('\n')}\n\nDo it again, fixing exactly those problems.`
        : base;

      await c.throttle.take();
      const began = Date.now();
      let result: unknown;
      try {
        result = await withRetry(() => artDirector.generate(prompt, opts), {
          onRetry: (info) =>
            c.events.emit('model.retry', { stage: 'art-direction', model: ART_DIRECTOR_MODEL, ...info }),
        });
      } catch (error) {
        if (!artDirectorFallback || retryPlanFor(error, 0) === null) throw error;
        c.events.emit('model.fallback', {
          stage: 'art-direction', from: ART_DIRECTOR_MODEL, to: ART_DIRECTOR_FALLBACK_MODEL,
        });
        await c.throttle.take();
        result = await withRetry(() => artDirectorFallback!.generate(prompt, opts), {});
      }
      c.cost.record('art-direction', ART_DIRECTOR_MODEL, await readUsage(result), Date.now() - began);

      const d = (result as { object?: ArtDirection }).object;
      if (!d) {
        last = ['the model returned nothing in the expected shape'];
        c.issues.push(...last);
        continue;
      }

      const issues = checkDirection(d, c.brief);
      if (!issues.length) {
        c.direction = d;
        c.events.emit('copy.written', {
          stage: 'art-direction',
          attempt: attempt + 1,
          lines: d.headlineLines,
          scale: d.productScale,
        });
        return { runId, skipRender: inputData.skipRender };
      }
      last = issues;
      c.issues.push(...issues);
      c.events.emit('copy.rejected', { stage: 'art-direction', attempt: attempt + 1, issues });
    }

    /** Out of attempts: the fallback layout is already in place. */
    c.events.emit('copy.rejected', {
      stage: 'art-direction',
      issues: ['out of attempts, using the fallback layout'],
    });
    return { runId, skipRender: inputData.skipRender };
  },
});

const render = createStep({
  id: 'render',
  inputSchema: stateSchema,
  outputSchema: z.custom<ArtDirectResult>(),
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);

    if (!inputData.skipRender) {
      try {
        c.render = await renderBanner(c.brief, c.direction, { outDir: c.outDir, name: c.name });
        c.events.emit('run.completed', { png: c.render.png });
      } catch (error) {
        /**
         * A failed render must not throw away the decisions above it: they
         * cost money, and the layout is still worth looking at.
         */
        c.renderError = error instanceof Error ? error.message : String(error);
        c.events.emit('run.failed', { reason: c.renderError });
      }
    } else {
      c.events.emit('run.completed', { png: null });
    }

    await c.events.flush();
    const out: ArtDirectResult = {
      runId: inputData.runId,
      direction: c.direction,
      issues: c.issues,
      render: c.render,
      renderError: c.renderError,
      cost: c.cost.summary(),
      events: c.events.timeline(),
    };
    contexts.delete(inputData.runId);
    return out;
  },
});

export const artDirectWorkflow = createWorkflow({
  id: 'art-direct',
  description: 'Decides the banner layout and renders the 2048×768 image',
  inputSchema,
  outputSchema: z.custom<ArtDirectResult>(),
})
  .then(direct)
  .then(render)
  .commit();
