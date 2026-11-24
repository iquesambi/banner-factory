/**
 * Shared with the category validator: the Gemini free tier allows 15 requests
 * per minute, which is a hard ceiling on any step that touches many products.
 */
export const RPM_LIMIT = 15;

export class RpmThrottle {
  private times: number[] = [];
  constructor(private limit: number = RPM_LIMIT) {}
  async take() {
    for (;;) {
      const now = Date.now();
      this.times = this.times.filter((t) => now - t < 60_000);
      if (this.times.length < this.limit) {
        this.times.push(now);
        return;
      }
      const waitMs = 60_000 - (now - this.times[0]!) + 250;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

export type RetryKind = 'rate-limit' | 'transient';
export interface RetryPlan {
  kind: RetryKind;
  delayMs: number;
}

/**
 * Two different upstream failures need two different waits.
 *
 * A rate limit is our fault and the provider says exactly how long to wait, so
 * we obey it. A 503 is the provider's own capacity — "this model is currently
 * experiencing high demand" — and there is no stated delay, so it gets
 * exponential backoff. The first version of this only matched 429s, and a
 * single 503 took down a whole run.
 */
export function retryPlanFor(error: unknown, attempt: number): RetryPlan | null {
  const msg = error instanceof Error ? error.message : String(error);
  const status = (error as { statusCode?: number } | null)?.statusCode;

  /**
   * An exhausted account is not a rate limit, however much the message looks
   * like one. Gemini answers a spent balance with 429 and the words "You
   * exceeded your current quota, please check your plan and billing details"
   * before it finally answers 402, so a run spent a full minute waiting
   * politely for credits to reappear. Waiting cannot help here: the next
   * attempt fails for the same reason, and the only fix is off this machine.
   */
  if (status === 402 || /prepayment|credits are depleted|billing details|check your plan/i.test(msg)) {
    return null;
  }

  if (/quota|rate.?limit|429/i.test(msg) || status === 429) {
    const m = msg.match(/retry in ([\d.]+)s/i);
    return { kind: 'rate-limit', delayMs: m ? Math.ceil(Number(m[1]) * 1000) + 500 : 20_000 };
  }

  const transient =
    /\b50[0234]\b|unavailable|high demand|overloaded|internal error|deadline exceeded|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg) ||
    (typeof status === 'number' && status >= 500);
  if (transient) {
    const jitter = Math.floor(Math.random() * 600);
    return { kind: 'transient', delayMs: 2000 * 2 ** attempt + jitter };
  }

  return null;
}

export interface RetryOptions {
  attempts?: number;
  /** Called before each wait, for event emission. */
  onRetry?: (info: { attempt: number; kind: RetryKind; delayMs: number; message: string }) => void;
}

/**
 * Runs one model call, surviving rate limits and provider hiccups. On the last
 * attempt the error is rethrown rather than swallowed: a step that cannot get
 * an answer must fail loudly, not return an empty result that reads like a
 * considered "no".
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  // 5 attempts means waits of roughly 2s, 4s, 8s and 16s. Provider capacity
  // spikes last longer than that sometimes, and then failing is correct.
  const attempts = opts.attempts ?? 5;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const plan = retryPlanFor(error, attempt);
      if (!plan || attempt >= attempts - 1) throw error;
      opts.onRetry?.({
        attempt: attempt + 1,
        kind: plan.kind,
        delayMs: plan.delayMs,
        message: error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120),
      });
      await new Promise((r) => setTimeout(r, plan.delayMs));
    }
  }
}
