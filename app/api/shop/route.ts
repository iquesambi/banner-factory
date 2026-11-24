import { NextResponse } from 'next/server';
import { TagStore } from '@/src/store/index.js';
import type { TaggedProduct } from '@/src/types.js';
import { listJobs } from '@/app/lib/jobs.js';
import { cors, preflight } from '@/app/lib/cors.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the demo shop needs from the feed, and nothing else.
 *
 * It reads the catalogue directly and makes no model call. That is the point:
 * a shop page that asked the matcher for its product list would spend money
 * every time somebody loaded it, and the five products under the banner are
 * not a recommendation — they are shelf filling.
 */

export interface ShopProduct {
  sku: string;
  name: string;
  price: number;
  oldPrice: number | null;
  saveAmount: number | null;
  stockBand: string;
  image: string | null;
  energyClass: string | null;
  salesPoint: string | null;
  category: string | null;
}

const shown = (p: TaggedProduct): ShopProduct => ({
  sku: p.sku,
  name: p.name,
  price: p.price,
  /** Only when the feed agrees with itself; the same rule the banners use. */
  oldPrice: p.oldPrice !== null && p.saveAmount !== null && p.oldPrice > p.price ? p.oldPrice : null,
  saveAmount: p.saveAmount !== null && p.saveAmount > 0 ? p.saveAmount : null,
  stockBand: p.stockBand,
  image: p.image,
  energyClass: p.energyClass,
  salesPoint: p.salesPoint,
  category: p.category,
});

const inStock = (p: TaggedProduct) => {
  const b = (p.stockBand ?? '').trim();
  return b !== '' && b !== '0';
};

/**
 * The hero: the newest banner that was actually delivered.
 *
 * The demo has to open on a product that HAS a banner, or the whole page is
 * an empty box. A variant is skipped — which banner of a running test gets
 * shown is decided by the serving endpoint, not here.
 */
function hero(): { sku: string; language: string } | null {
  const job = listJobs().find((j) => j.png && j.brief && !j.variant);
  return job?.brief ? { sku: job.brief.product.sku, language: job.language } : null;
}

export function OPTIONS() {
  return preflight();
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const asked = url.searchParams.get('sku')?.trim() ?? '';
  const front = hero();

  const store = new TagStore().load();
  const sku = asked || front?.sku || '';
  const product = sku ? store.get(sku) : null;
  if (!product) {
    return cors(NextResponse.json({ error: 'no such product' }, { status: 404 }));
  }

  /**
   * The shelf around it: same section first, then the wider department, in
   * stock and photographed. Sorted by SKU rather than by anything clever, so
   * the page looks the same every time it is loaded — a shelf that reshuffles
   * on every reload makes a demo look broken.
   */
  const department = (product.category ?? '').split('/')[0] ?? '';
  const pool = store.all().filter(
    (p) => p.sku !== product.sku && p.image && inStock(p) && p.category?.startsWith(department),
  );
  const bySku = (a: TaggedProduct, b: TaggedProduct) => a.sku.localeCompare(b.sku);
  /**
   * Sorted WITHIN each group and then joined, not sorted after joining —
   * which is what the first version did, and it threw away the ordering it
   * had just worked out: a dishwasher's shelf came back full of cooker
   * hoods because their SKUs happened to be lower.
   */
  const near = pool.filter((p) => p.category === product.category).sort(bySku);
  const wider = pool.filter((p) => p.category !== product.category).sort(bySku);
  const related = [...near, ...wider].slice(0, 5).map(shown);

  return cors(
    NextResponse.json({
      hero: front,
      product: shown(product),
      related,
    }),
  );
}
