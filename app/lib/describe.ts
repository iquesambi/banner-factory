import type { JobEvent } from './types';

/**
 * Turns one workflow event into a line a person can read.
 *
 * The events were designed for a log and carry raw counts. This is the only
 * place that knows how to say them in words, so the board, the card and
 * anything later all read the same.
 *
 * Events with nothing to tell a human — the bookkeeping ones that only open
 * and close a run — return null and are left out entirely.
 */
export interface Described {
  title: string;
  detail: string;
  tag: string;
  free: boolean;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const FREE = { tag: 'free', free: true };
const CACHED = { tag: 'cached', free: true };
const paid = (calls: number) => ({ tag: `${calls} call${calls === 1 ? '' : 's'}`, free: false });

export function describe(e: JobEvent): Described | null {
  const d = e.data;

  switch (e.stage) {
    case 'seed.loaded':
      return {
        title: 'Loading the seed',
        detail: [str(d.name), str(d.category)].filter(Boolean).join(' · '),
        ...FREE,
      };

    case 'seed.validated': {
      const requests = num(d.requests) ?? 0;
      return {
        title: "Checking the seed's category",
        detail: requests === 0 ? 'already clean, no model call' : `${requests} call${requests === 1 ? '' : 's'}`,
        ...(requests === 0 ? FREE : paid(requests)),
      };
    }

    case 'stock.checked':
      return {
        title: 'Checking stock',
        detail: d.inStock
          ? 'in stock — the banner is for the seed itself'
          : 'out of stock, so a substitute is worth finding',
        ...FREE,
      };

    case 'variant.matched':
      return {
        title: 'Same product in another colour',
        detail: d.found ? 'found one, no model needed' : 'none found',
        ...FREE,
      };

    case 'category.pool.validated': {
      const pool = num(d.pool) ?? 0;
      return {
        title: 'Building the category pool',
        detail: d.skipped ? `${pool} products, cleaning skipped` : `${pool} products`,
        ...FREE,
      };
    }

    case 'tier.completed': {
      const cached = num(d.cached) ?? 0;
      const classified = num(d.classified) ?? 0;
      const seedTier = num(d.seedTier);
      return {
        title: 'Classifying the premium tier',
        detail: [
          `${cached} cached, ${classified} classified`,
          seedTier !== null ? `the seed is tier ${seedTier}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        ...(classified === 0 ? CACHED : paid(1)),
      };
    }

    case 'recommend.pass1':
    case 'recommend.pass2': {
      const candidates = num(d.candidates) ?? 0;
      const picks = num(d.picks) ?? 0;
      const none = str(d.noneReason);
      const widened = e.stage === 'recommend.pass2';
      return {
        title: widened ? 'Opening up to the neighbouring tier' : 'Choosing within the same tier',
        detail: picks
          ? `${candidates} candidates · ${picks} offered`
          : `${candidates} candidates · none offered${none ? ` — ${none}` : ''}`,
        ...paid(1),
      };
    }

    case 'copy.written': {
      const headline = str(d.headline);
      return {
        title: 'Writing the copy',
        detail: headline ? `“${headline}”` : '',
        ...paid(1),
      };
    }

    case 'copy.rejected': {
      const issues = Array.isArray(d.issues) ? d.issues : [];
      return {
        title: 'A draft was rejected by the checks',
        detail: issues.map(String).join(' · '),
        tag: 'retry',
        free: false,
      };
    }

    case 'strategy.decided': {
      const show = Array.isArray(d.show) ? d.show.map(String) : [];
      const skip = Array.isArray(d.skip) ? d.skip.map(String) : [];
      return {
        title: 'Choosing the badges',
        detail: [
          show.length ? `showing ${show.join(', ')}` : 'no badge earned a place',
          skip.length ? `left off ${skip.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        ...paid(1),
      };
    }

    case 'model.retry':
      return {
        title: 'The provider pushed back',
        detail: `${str(d.kind) ?? 'retry'} · waiting ${Math.round((num(d.delayMs) ?? 0) / 1000)}s`,
        tag: 'retry',
        free: false,
      };

    case 'model.fallback':
      return {
        title: 'Fell back to another model',
        detail: `${str(d.from) ?? ''} → ${str(d.to) ?? ''}`,
        tag: 'fallback',
        free: false,
      };

    case 'run.failed':
      return { title: 'Stopped', detail: str(d.reason) ?? '', tag: 'failed', free: false };

    /**
     * `run.started`, `run.completed`, `facts.built` and `tier.started` exist
     * so the log brackets each stage. They say nothing a person reading the
     * card needs, and printing them would bury the eight lines that matter.
     */
    default:
      return null;
  }
}
