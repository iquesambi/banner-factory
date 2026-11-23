import { ConsoleLogger, LogLevel, type LogFilterContext } from '@mastra/core/logger';

/**
 * The project's logger, used by Mastra and by our own run events, so there is
 * one stream and one level to control instead of two.
 *
 * Level comes from MASTRA_LOG_LEVEL (debug | info | warn | error | silent).
 * At `info` you get the readable run timeline; at `debug` each stage event is
 * logged with its full structured payload as well.
 */
const LEVELS = new Set<string>(Object.values(LogLevel));
const level = (LEVELS.has(process.env.MASTRA_LOG_LEVEL ?? '')
  ? process.env.MASTRA_LOG_LEVEL
  : LogLevel.INFO) as LogLevel;

/**
 * Drops exactly one thing: an upstream model error that the SDK itself marked
 * retryable, which we do retry and do report as a `model.retry` event.
 *
 * It is worth being precise about why. Mastra logs that error with the whole
 * request payload attached, and for a tier call the payload is every product
 * name in the category — a few thousand lines on screen for a hiccup that the
 * run recovered from in two seconds. Anything the SDK did NOT mark retryable
 * still prints in full, and setting MASTRA_LOG_LEVEL=debug brings these back
 * too, so nothing is permanently hidden.
 */
function hideHandledRetries(ctx: LogFilterContext): boolean {
  if (level === LogLevel.DEBUG) return true;
  if (ctx.level !== LogLevel.ERROR) return true;
  if (!/upstream llm api error/i.test(ctx.message)) return true;
  const retryable = ctx.args.some(
    (a) =>
      typeof a === 'object' && a !== null &&
      (('isRetryable' in a && (a as { isRetryable?: unknown }).isRetryable === true) ||
        ('error' in a &&
          typeof (a as { error?: unknown }).error === 'object' &&
          (a as { error?: { isRetryable?: unknown } }).error?.isRetryable === true)),
  );
  return !retryable;
}

export const bannerLogger = new ConsoleLogger({
  name: 'banner-factory',
  level,
  filter: hideHandledRetries,
});
