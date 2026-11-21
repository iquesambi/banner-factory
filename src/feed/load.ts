import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { RawProduct } from '../types.js';

export const DEFAULT_FEED = 'data/2026-08-25-elkjop-ai-personalisation-pilot-ddb-dk.json.gz';

export interface LoadedFeed {
  version: string;
  products: RawProduct[];
}

export function loadFeed(path = DEFAULT_FEED): LoadedFeed {
  const gz = readFileSync(path);
  const version = createHash('sha256').update(gz).digest('hex').slice(0, 12);
  const products = JSON.parse(gunzipSync(gz).toString('utf8')) as RawProduct[];
  return { version, products };
}

function num(value: string): number | null {
  const n = Number.parseFloat((value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Carries the feed's own values across, and computes exactly one thing: the
 * discount percentage. Nothing here interprets whether a product is on
 * promotion, in stock, or fit to appear anywhere — those are product rules and
 * they are not the tagger's to make.
 */
export function derive(raw: RawProduct) {
  const price = num(raw.Price) ?? 0;
  const saveAmount = num(raw.SavePriceAmount);

  // Previous price as the brief defines it: Price + SavePriceAmount.
  const oldPrice = saveAmount !== null ? price + saveAmount : null;

  return {
    price,
    saveAmount,
    oldPrice,
    // Has a discount: percentage off the previous price. No discount: zero.
    discountPct:
      saveAmount !== null && saveAmount > 0
        ? Number(((saveAmount / (price + saveAmount)) * 100).toFixed(1))
        : 0,
    // Feed values, unmodified.
    stockBand: (raw.StockLevelEcomFormat ?? '').trim(),
    image: raw.Image?.trim() || null,
    energyClass: raw.EnergyEfficiencyClass?.trim() || null,
    salesPoint: raw.SalesPoint?.trim() || null,
  };
}
