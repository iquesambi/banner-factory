import 'server-only';
import { get as currentProduct } from './search.js';
import type { Job } from './types.js';
import type { Language } from '@/src/banner/facts.js';

/**
 * Not making a banner we already have.
 *
 * This is the cheapest thing the system can do, because the money is in the
 * model calls and a reuse makes none. It is also the easiest place to tell a
 * lie, so every reuse is validated against today's feed before it is allowed:
 * the brief records what the banner printed, and nothing that it printed may
 * have changed.
 *
 * The rule is narrow on purpose. Facts the banner SHOWS must still hold. Facts
 * it does not show are free to move — a product that has since gained a
 * discount has not made the old banner false, only less good, and that is
 * reported rather than treated as a failure.
 */

export interface ReuseCheck {
  ok: boolean;
  /** Why it cannot be reused, in words, for the card to show. */
  reasons: string[];
  /** True when the facts still hold but something better is now available. */
  couldBeBetter: string | null;
}

export interface ReuseHit {
  job: Job;
  check: ReuseCheck;
  /** Where the product sat in the matcher's list, 1-based. Null for a seed hit. */
  rank: number | null;
  how: 'seed' | 'pick';
}

/** A banner only counts as existing once it has actually been drawn. */
function isUsable(job: Job): boolean {
  return Boolean(job.png) && Boolean(job.brief) && Boolean(job.pick) && job.stage !== 'failed';
}

/**
 * Does everything this banner printed still hold?
 *
 * Reads the live catalogue, not the stored fingerprint, so a feed reload is
 * picked up without anyone recomputing anything.
 */
export function validate(job: Job): ReuseCheck {
  const reasons: string[] = [];
  let couldBeBetter: string | null = null;

  const sku = job.pick?.sku;
  const brief = job.brief;
  if (!sku || !brief) return { ok: false, reasons: ['the banner has no product on it'], couldBeBetter: null };

  const live = currentProduct(sku);
  if (!live) return { ok: false, reasons: ['the product is no longer in the feed'], couldBeBetter: null };

  /** 1. In stock. A banner pointing at an empty shelf is the worst outcome. */
  const band = live.stockBand.trim();
  if (!band || band === '0') reasons.push('the product is out of stock');

  /** 2. The price, which is printed in the largest type on the banner. */
  if (live.price !== brief.product.price) {
    reasons.push(
      `the price moved from ${brief.product.price.toLocaleString('da-DK')} to ${live.price.toLocaleString('da-DK')} kr`,
    );
  }

  /**
   * 3. The saving, but only if the banner put one on screen. A badge that was
   *    never shown cannot have become false.
   */
  const shown = brief.badges.find((b) => b.kind === 'saving');
  const liveSaving = savingOf(sku);

  if (shown) {
    if (liveSaving === null) {
      reasons.push('the saving the banner shows has ended');
    } else if (shown.amount !== undefined && shown.amount !== liveSaving.amount) {
      reasons.push(
        `the saving moved from ${shown.amount.toLocaleString('da-DK')} to ${liveSaving.amount.toLocaleString('da-DK')} kr`,
      );
    }
  } else if (liveSaving !== null) {
    couldBeBetter = `this product now has a ${liveSaving.amount.toLocaleString('da-DK')} kr saving the banner does not mention`;
  }

  return { ok: reasons.length === 0, reasons, couldBeBetter };
}

/**
 * The live saving, read the same way the truth layer reads it, so the two
 * cannot disagree about whether a saving exists.
 */
function savingOf(sku: string): { amount: number } | null {
  const live = currentProduct(sku);
  const amount = live?.saveAmount ?? null;
  return amount !== null && amount > 0 ? { amount } : null;
}

/** Most recent first, so a reuse picks the freshest banner of the set. */
function newestFirst(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * A banner made from this very seed, in this language.
 *
 * The cheapest hit there is: it skips choosing the product as well as writing
 * and drawing, so the whole run costs nothing.
 */
export function forSeed(jobs: Job[], seedSku: string, language: Language, excludeId: string): ReuseHit | null {
  const candidates = newestFirst(
    jobs.filter((j) => j.id !== excludeId && j.seed.sku === seedSku && j.language === language && isUsable(j)),
  );
  for (const job of candidates) {
    const check = validate(job);
    if (check.ok) return { job, check, rank: null, how: 'seed' };
  }
  return null;
}

/**
 * A banner for one of the products the matcher just offered.
 *
 * `maxRank` is the business rule: reuse only when the product with a banner is
 * near the top of the list. Without a limit, a cached banner for the fifth
 * choice would beat a fresh one for the first, and the saving would be buying
 * a worse recommendation.
 */
export function forPicks(
  jobs: Job[],
  picks: Array<{ sku: string }>,
  language: Language,
  maxRank: number,
  excludeId: string,
): ReuseHit | null {
  const limit = Math.max(1, Math.min(maxRank, picks.length));
  for (let i = 0; i < limit; i++) {
    const sku = picks[i]?.sku;
    if (!sku) continue;
    const candidates = newestFirst(
      jobs.filter((j) => j.id !== excludeId && j.pick?.sku === sku && j.language === language && isUsable(j)),
    );
    for (const job of candidates) {
      const check = validate(job);
      if (check.ok) return { job, check, rank: i + 1, how: 'pick' };
    }
  }
  return null;
}
