/**
 * Stage events for one run.
 *
 * Two consumers: the CLI prints them as a timeline, and a webhook POSTs them
 * so a front end can show progress without polling. Nothing here may break a
 * run — a webhook that is down, slow or wrong is logged and ignored.
 */

export type RunStage =
  | 'run.started'
  | 'seed.loaded'
  | 'seed.validated'
  | 'stock.checked'
  | 'category.pool.validated'
  | 'variant.matched'
  | 'tier.started'
  | 'tier.completed'
  | 'model.retry'
  | 'model.fallback'
  | 'recommend.pass1'
  | 'recommend.pass2'
  | 'run.completed'
  | 'run.failed';

export interface RunEvent {
  runId: string;
  seq: number;
  stage: RunStage;
  at: string;
  elapsedMs: number;
  data: Record<string, unknown>;
}

/** The slice of Mastra's IMastraLogger this module needs. */
export interface StageLogger {
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface EventsOptions {
  /** Where to POST each event. Defaults to BANNER_WEBHOOK_URL. */
  webhookUrl?: string | undefined;
  /** Print each event as it happens. */
  verbose?: boolean;
  timeoutMs?: number;
  /**
   * Mastra's logger. Stage lines go out at info and the full structured event
   * at debug, so one MASTRA_LOG_LEVEL controls how much a run says.
   */
  logger?: StageLogger | undefined;
}

export class RunEvents {
  private events: RunEvent[] = [];
  private pending: Promise<void>[] = [];
  private startedAt = Date.now();
  private seq = 0;
  private webhookUrl: string | undefined;
  private failures: string[] = [];

  constructor(public readonly runId: string, private opts: EventsOptions = {}) {
    this.webhookUrl = opts.webhookUrl ?? process.env.BANNER_WEBHOOK_URL ?? undefined;
  }

  emit(stage: RunStage, data: Record<string, unknown> = {}): RunEvent {
    const event: RunEvent = {
      runId: this.runId,
      seq: ++this.seq,
      stage,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - this.startedAt,
      data,
    };
    this.events.push(event);
    if (this.opts.verbose) {
      const detail = Object.entries(data)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' ');
      const line = `[${String(event.elapsedMs).padStart(6)}ms] ${stage.padEnd(24)} ${detail}`;
      if (this.opts.logger) {
        this.opts.logger.info(line);
        this.opts.logger.debug(`event ${stage}`, event);
      } else {
        console.log(`  ${line}`);
      }
    }
    if (this.webhookUrl) this.pending.push(this.post(this.webhookUrl, event));
    return event;
  }

  private async post(url: string, event: RunEvent) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 3000),
      });
      if (!res.ok) this.failures.push(`${event.stage}: HTTP ${res.status}`);
    } catch (error) {
      this.failures.push(`${event.stage}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Node exits before fire-and-forget posts land, so the CLI awaits this. */
  async flush() {
    await Promise.allSettled(this.pending);
    this.pending = [];
    return { delivered: this.events.length - this.failures.length, failures: [...this.failures] };
  }

  timeline() { return [...this.events]; }
  get webhookConfigured() { return Boolean(this.webhookUrl); }
}
