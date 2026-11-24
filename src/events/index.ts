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
  | 'pool.built'
  | 'promo.checked'
  | 'cluster.decided'
  | 'categories.picked'
  | 'category.pool.validated'
  | 'variant.matched'
  | 'tier.started'
  | 'tier.completed'
  | 'model.retry'
  | 'model.fallback'
  | 'recommend.pass1'
  | 'recommend.pass2'
  | 'facts.built'
  | 'copy.written'
  | 'copy.rejected'
  | 'strategy.decided'
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

/**
 * In-process listeners, keyed by run id.
 *
 * The webhook is for anything outside this process. The front end runs the
 * workflows in its own server, so posting an HTTP request to itself just to
 * read back an event it already has would add latency and a failure mode for
 * nothing. A caller that holds the run id — `createRun()` hands it over
 * before `start()` — subscribes here instead.
 */
type RunEventListener = (event: RunEvent) => void;
const listeners = new Map<string, Set<RunEventListener>>();

/** Returns the unsubscribe function; always call it, or the run leaks. */
export function onRunEvent(runId: string, fn: RunEventListener): () => void {
  let set = listeners.get(runId);
  if (!set) {
    set = new Set();
    listeners.set(runId, set);
  }
  set.add(fn);
  return () => {
    const live = listeners.get(runId);
    if (!live) return;
    live.delete(fn);
    if (!live.size) listeners.delete(runId);
  };
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
    /** A listener that throws must not take the run down with it. */
    const subscribed = listeners.get(this.runId);
    if (subscribed) {
      for (const fn of subscribed) {
        try { fn(event); } catch { /* a reader's problem, not the run's */ }
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
