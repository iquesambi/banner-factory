/**
 * What one banner cost.
 *
 * Token counts come from the provider's own `usage` on each response, so they
 * are measured, not estimated. The money figure is only as good as the rates
 * in the environment: prices change and I am not going to hardcode a number
 * that silently goes stale. With no rates set, the meter still reports every
 * token and says plainly that it cannot price them.
 */

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

/**
 * Rates are per model family, because a run may mix a cheap classifier with a
 * stronger model for copy. Set them from the provider's current price page:
 *
 *   GEMINI_PRICE_IN_PER_MTOK=0.10
 *   GEMINI_PRICE_OUT_PER_MTOK=0.40
 */
export function rateFor(model: string): Rate | null {
  const family = model.startsWith('gemini') ? 'GEMINI' : null;
  if (!family) return null;
  const i = num(process.env[`${family}_PRICE_IN_PER_MTOK`]);
  const o = num(process.env[`${family}_PRICE_OUT_PER_MTOK`]);
  if (i === null || o === null) return null;
  return { inPerMTok: i, outPerMTok: o };
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
