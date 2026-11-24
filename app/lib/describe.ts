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
          ? 'in stock — nothing to replace, so the banner becomes a suggestion'
          : 'out of stock, so a substitute is worth finding',
        ...FREE,
      };

    case 'pool.built': {
      const suggest = str(d.mode) === 'suggest';
      const live = num(d.inStock) ?? 0;
      const shortlist = num(d.shortlist) ?? 0;
      return {
        title: suggest ? 'Looking wider than the shelf' : 'Building the pool',
        detail: suggest
          ? `${live.toLocaleString('en-GB')} in stock under ${str(d.root) ?? ''} · shortlisted ${shortlist}`
          : `${shortlist} products in the same category`,
        ...FREE,
      };
    }

    case 'promo.checked': {
      const threshold = num(d.threshold) ?? 0;
      if (!d.found) {
        return {
          title: 'Looking for a discount worth a banner',
          detail: `nothing above ${threshold}% on this product or its variants`,
          ...FREE,
        };
      }
      return {
        title: 'A discount decided it on its own',
        detail: `${str(d.how) === 'seed' ? 'this product' : 'another variant'} is ${
          num(d.discountPct) ?? 0
        }% off — no model was asked`,
        ...FREE,
      };
    }

    case 'cluster.decided': {
      if (d.skipped) return null;
      const byBrand = str(d.by) === 'brand';
      return {
        title: 'Reading the customer',
        detail: [
          str(d.cluster),
          byBrand ? `settled by the brand ${str(d.brand) ?? ''}`.trim() : str(d.reason),
        ]
          .filter(Boolean)
          .join(' — '),
        ...(byBrand ? FREE : paid(1)),
      };
    }

    case 'categories.picked': {
      if (d.skipped) return null;
      const picked = Array.isArray(d.picked) ? d.picked.map(String) : [];
      return {
        title: 'Choosing which sections of the shop to draw from',
        detail: picked.length
          ? `${picked.length} of ${num(d.offered) ?? 0} · ${picked.join(', ')}`
          : `none of the ${num(d.offered) ?? 0} sections was picked`,
        ...paid(1),
      };
    }

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
        title: widened ? 'Opening up to the neighbouring tier' : 'Choosing among the candidates',
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

    case 'policy.applied': {
      if (d.skipped) {
        return {
          title: 'The business policy did not run',
          detail: String(d.skipped),
          tag: 'skipped',
          free: true,
        };
      }
      if (d.badIndex !== undefined && d.badIndex !== null) {
        return {
          title: 'The business policy answered off the list',
          detail: `it chose ${String(d.badIndex)}, which was not offered — the ranking stands`,
          ...paid(1),
        };
      }
      const moved = num(d.movedFrom);
      return {
        title: d.decided ? 'The business policy chose' : 'The business policy had no preference',
        detail: [
          moved ? `moved choice ${moved} to the front` : 'kept the first choice',
          str(d.because),
        ].filter(Boolean).join(' — '),
        ...paid(1),
      };
    }

    /**
     * A product that a person decided, not an agent: dragging the card back
     * to Choosing, or asking for the seed itself or for a translation. It
     * costs nothing — the product was named rather than found — and it has to
     * appear in the timeline, or the card shows copy about a product with no
     * record of how that product got there.
     */
    case 'pick.changed': {
      const position = num(d.position);
      const of = num(d.of);
      return {
        title: 'The product was decided by hand',
        detail: [
          str(d.now),
          str(d.reason),
          position && of ? `choice ${position} of ${of}` : null,
        ].filter(Boolean).join(' · '),
        ...FREE,
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
