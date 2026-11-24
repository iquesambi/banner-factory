import type { TaggedProduct } from '../types.js';
import { inStock, stockRank, variantKey } from './variant.js';

/**
 * The cheapest answer of all, when the customer's product is in stock.
 *
 * If that product — or the same product in another variant — is carrying a
 * real discount, there is nothing to decide. The banner shows it. No model
 * runs, because no judgement is needed: a price cut on the thing the person
 * was already looking at is the offer.
 *
 * This runs before any agent, and it is the reason the agents often do not
 * run at all.
 */

/** Configurable later; the number the business will want to tune first. */
export const PROMO_THRESHOLD_PCT = Number(process.env.PROMO_THRESHOLD_PCT ?? 30);

export interface PromoHit {
  product: TaggedProduct;
  /** The seed itself, or the same product in another colour or size. */
  how: 'seed' | 'variant';
  discountPct: number;
  reason: string;
}

/**
 * Only a discount the feed agrees with itself about.
 *
 * Measured on this catalogue: 56 products state a saving on the label that
 * contradicts the saving field, and in three the previous price is below the
 * current one. A banner built on one of those would print a false saving,
 * which is the one thing the brief forbids outright.
 */
function trustworthy(p: TaggedProduct): boolean {
  if (p.discountPct <= 0) return false;
  if (p.saveAmount === null || p.saveAmount <= 0) return false;
  if (p.oldPrice === null || p.oldPrice <= p.price) return false;
  const label = /^(?:rest\s+)?spar\s+([0-9.,]+)$/i.exec((p.salesPoint ?? '').trim());
  if (label?.[1]) {
    const stated = Number(label[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(stated) && Math.abs(stated - p.saveAmount) >= 1) return false;
  }
  return true;
}

function qualifies(p: TaggedProduct, threshold: number): boolean {
  return inStock(p) && Boolean(p.image) && trustworthy(p) && p.discountPct > threshold;
}

/**
 * The seed, or a direct variant of it, on a discount worth a banner.
 *
 * "Direct variant" is the same product name with the trailing parenthetical
 * dropped — the same rule the substitution path uses, so colour and finish
 * count as the same product in both places.
 */
export function promoShortcut(
  seed: TaggedProduct,
  pool: TaggedProduct[],
  threshold = PROMO_THRESHOLD_PCT,
): PromoHit | null {
  /** The seed first: the customer is already looking at it. */
  if (qualifies(seed, threshold)) {
    return {
      product: seed,
      how: 'seed',
      discountPct: seed.discountPct,
      reason: `The product the customer is looking at is ${seed.discountPct}% off.`,
    };
  }

  const key = variantKey(seed.name);
  if (!key) return null;

  const variants = pool.filter(
    (p) => p.sku !== seed.sku && p.category === seed.category && variantKey(p.name) === key && qualifies(p, threshold),
  );
  if (!variants.length) return null;

  /** Deepest discount wins, then deepest stock: both are business facts. */
  variants.sort(
    (a, b) => b.discountPct - a.discountPct || stockRank(b.stockBand) - stockRank(a.stockBand),
  );
  const best = variants[0]!;

  return {
    product: best,
    how: 'variant',
    discountPct: best.discountPct,
    reason: `The same product in another variant is ${best.discountPct}% off.`,
  };
}
