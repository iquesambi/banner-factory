/**
 * What one banner cost.
 *
 * Token counts come from the provider's own `usage` on each response, so they
 * are measured, not estimated.
 *
 * Turning them into money needs a rate, and there is no pricing API to ask:
 * Google's own page says nothing about one, and the aggregators that claim to
 * have the numbers disagree with each other. So the rates live in
 * `prices.json` — checked in, dated, and carrying the URL they were read
 * from. That is reference data, not configuration: it belongs where a
 * reviewer can see it go stale, not in an environment variable nobody opens.
 *
 * An environment variable still wins when it is set, for a negotiated rate or
 * a quick experiment, and the meter reports which of the two it used.
 */
import PRICES from './prices.json' with { type: 'json' };

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
}

export interface Rate {
  /** USD per million input tokens. */
  inPerMTok: number;
  /** USD per million output tokens. */
  outPerMTok: number;
}

export interface CallRecord {
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  usd: number | null;
  durationMs: number;
}

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface PricePeriod {
  from: string;
  in: number;
  out: number;
}

const TABLE = PRICES as unknown as {
  source: string;
  readAt: string;
  models: Record<string, PricePeriod[]>;
  notVerbatim: string[];
};

/** Where a rate came from, so the number can be doubted on purpose. */
export type RateOrigin = 'env' | 'table' | 'table-unconfirmed';

export interface SourcedRate extends Rate {
  origin: RateOrigin;
  /** The date the table was read, for a table rate. */
  readAt?: string;
}

/**
 * The rate for one model, at a point in time.
 *
 * Prices have scheduled changes — Google lists the dates on the page — so the
 * table holds one entry per period and this picks the latest one that has
 * already started. A run in November and the same run in January price
 * differently, which is correct and would otherwise be silently wrong.
 */
export function rateFor(model: string, at: Date = new Date()): SourcedRate | null {
  /** An explicit rate always wins: it is someone saying they know better. */
  const family = model.startsWith('gemini') ? 'GEMINI' : null;
  if (family) {
    const i = num(process.env[`${family}_PRICE_IN_PER_MTOK`]);
    const o = num(process.env[`${family}_PRICE_OUT_PER_MTOK`]);
    if (i !== null && o !== null) return { inPerMTok: i, outPerMTok: o, origin: 'env' };
  }

  const periods = TABLE.models[model];
  if (!periods?.length) return null;

  const day = at.toISOString().slice(0, 10);
  const live = periods.filter((p) => p.from <= day).sort((a, b) => a.from.localeCompare(b.from)).at(-1);
  if (!live) return null;

  return {
    inPerMTok: live.in,
    outPerMTok: live.out,
    origin: TABLE.notVerbatim.includes(model) ? 'table-unconfirmed' : 'table',
    readAt: TABLE.readAt,
  };
}

/** For anything that wants to show where the numbers came from. */
export function priceSource(): { url: string; readAt: string } {
  return { url: TABLE.source, readAt: TABLE.readAt };
}

export class CostMeter {
  private records: CallRecord[] = [];

  record(stage: string, model: string, usage: ModelUsage | undefined, durationMs: number) {
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const cachedInputTokens = usage?.cachedInputTokens ?? 0;
    const rate = rateFor(model);
    const usd = rate
      ? (inputTokens / 1_000_000) * rate.inPerMTok + (outputTokens / 1_000_000) * rate.outPerMTok
      : null;
    this.records.push({ stage, model, inputTokens, outputTokens, cachedInputTokens, usd, durationMs });
    return this.records[this.records.length - 1]!;
  }

  /** A call that was avoided, so the saving is visible rather than invisible. */
  private savedCalls = 0;
  saved(n = 1) { this.savedCalls += n; }

  summary() {
    const inputTokens = this.records.reduce((a, r) => a + r.inputTokens, 0);
    const outputTokens = this.records.reduce((a, r) => a + r.outputTokens, 0);
    const priced = this.records.filter((r) => r.usd !== null);
    const usd = priced.length ? priced.reduce((a, r) => a + (r.usd ?? 0), 0) : null;
    const byStage: Record<string, { calls: number; inputTokens: number; outputTokens: number }> = {};
    for (const r of this.records) {
      const b = (byStage[r.stage] ??= { calls: 0, inputTokens: 0, outputTokens: 0 });
      b.calls++;
      b.inputTokens += r.inputTokens;
      b.outputTokens += r.outputTokens;
    }
    return {
      calls: this.records.length,
      callsAvoidedByCache: this.savedCalls,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      usd,
      /** False when no rate was configured, so `usd` is null rather than wrong. */
      priced: priced.length === this.records.length && this.records.length > 0,
      modelMs: this.records.reduce((a, r) => a + r.durationMs, 0),
      byStage,
      records: this.records,
    };
  }
}

/**
 * Pulls usage off a model result, tolerating both the v4 and v5 field names
 * and the fact that Mastra exposes `usage` as a promise on some result types.
 * Returns undefined rather than throwing: a missing token count must never
 * fail a run, it just makes the bill incomplete, which the summary shows.
 */
export async function readUsage(result: unknown): Promise<ModelUsage | undefined> {
  const raw = await (result as { usage?: unknown } | null | undefined)?.usage;
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const inputTokens = n(o.inputTokens ?? o.promptTokens);
  const outputTokens = n(o.outputTokens ?? o.completionTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: n(o.totalTokens) || inputTokens + outputTokens,
    ...(typeof o.cachedInputTokens === 'number' ? { cachedInputTokens: o.cachedInputTokens } : {}),
  };
}
