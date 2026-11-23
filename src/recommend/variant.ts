import type { TaggedProduct } from '../types.js';
import { fold } from '../tagger/normalize.js';

/** Feed stock bands, deepest first. Anything else is treated as none. */
const STOCK_ORDER = ['100+', '50+', '25+', '5+', '<5'] as const;

export function stockRank(band: string | null | undefined): number {
  const i = STOCK_ORDER.indexOf((band ?? '').trim() as (typeof STOCK_ORDER)[number]);
  return i < 0 ? 0 : STOCK_ORDER.length - i;
}

export function inStock(p: TaggedProduct): boolean {
  return stockRank(p.stockBand) > 0;
}

/**
 * The product minus its variant suffix.
 *
 * Elgiganten writes the variant in a trailing parenthetical: the same phone is
 * "... 16GB/1TB (violet shadow)" and "... 16GB/1TB (graphite)". Dropping that
 * one group leaves a key that is equal for colour variants and different for
 * anything else — capacity, generation and model code all sit outside it, so
 * "12/256GB (graphite)" does NOT collapse into "16GB/1TB (graphite)".
 *
 * Known limit: some names carry the colour outside parentheses, such as
 * "iPhone 17 Pro Max 5G smartphone 2TB Kosmisk Orange". Those variants are not
 * caught here and fall through to the model, which is the safe direction to
 * fail — a missed shortcut costs a call, a false match shows the wrong product.
 */
export function variantKey(name: string): string {
  return fold(name.replace(/\s*\([^()]*\)\s*$/, '').trim());
}

export interface VariantMatch {
  /** The one to show, by the default tiebreak. */
  pick: TaggedProduct;
  /** Everything else that is the same product in another variant. */
  others: TaggedProduct[];
}

/**
 * Same product, different variant, in stock.
 *
 * Deliberately deterministic and free: when this hits there is nothing for a
 * model to decide, and the answer is better than anything a model could pick.
 */
export function findExactVariant(
  seed: TaggedProduct,
  pool: TaggedProduct[],
): VariantMatch | null {
  const key = variantKey(seed.name);
  if (!key) return null;

  const matches = pool.filter(
    (p) =>
      p.sku !== seed.sku &&
      inStock(p) &&
      p.category === seed.category &&
      variantKey(p.name) === key,
  );
  if (!matches.length) return null;

  /**
   * The tiebreak between two identical products is a business decision, not a
   * technical one. This default — deepest stock, then closest price, then
   * cheapest — is here so the step is reproducible, and is the obvious place
   * to put a real rule later.
   *
   * Decided and kept: the trailing parenthetical is dropped whole, so what it
   * holds beyond colour is dropped with it. An "AndaSeat Kaiser 4 Series
   * gamingstol (sort)" and a "(sort stof)" match here, although `stof` is
   * fabric and not a shade. Asked about it; the answer was to leave it as it
   * is. So this step can substitute a material, not only a colour, and that
   * is the intended behaviour rather than an oversight.
   */
  const ranked = [...matches].sort(
    (a, b) =>
      stockRank(b.stockBand) - stockRank(a.stockBand) ||
      Math.abs(a.price - seed.price) - Math.abs(b.price - seed.price) ||
      a.price - b.price,
  );
  return { pick: ranked[0]!, others: ranked.slice(1) };
}
