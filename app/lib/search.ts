import 'server-only';
import { TagStore } from '@/src/store/index.js';
import type { TaggedProduct } from '@/src/types.js';

/**
 * The product index, built once per server process.
 *
 * Firestore matches on a prefix, so "fold8" would never find "Samsung Galaxy
 * Z Fold8 Ultra" there. The 28,231 names are about 1.2 MB, which is nothing
 * to hold in memory, and a substring scan over them is instant. That buys a
 * real search with no new service and no new dependency.
 */
export interface Hit {
  sku: string;
  name: string;
  price: number;
  stockBand: string;
  category: string | null;
  image: string | null;
}

interface Row extends Hit {
  haystack: string;
}

let rows: Row[] | null = null;

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function load(): Row[] {
  if (rows) return rows;
  const store = new TagStore().load();
  rows = store.all().map((p: TaggedProduct) => ({
    sku: p.sku,
    name: p.name,
    price: p.price,
    stockBand: p.stockBand,
    category: p.category,
    image: p.image,
    // The SKU goes in the haystack too: people paste one straight from the
    // feed, and a name-only index would answer nothing.
    haystack: `${fold(p.name)} ${p.sku.toLowerCase()}`,
  }));
  return rows;
}

export function search(query: string, limit = 8): Hit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const out: Hit[] = [];
  for (const r of load()) {
    if (!r.haystack.includes(q)) continue;
    out.push(r);
    if (out.length >= limit * 4) break;
  }
  /**
   * A name that starts with the query is almost always what was meant, and an
   * exact SKU is never a coincidence, so both float up before the rest.
   */
  out.sort((a, b) => rank(a, q) - rank(b, q) || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

function rank(hit: Hit, q: string): number {
  if (hit.sku.toLowerCase() === q) return 0;
  if (fold(hit.name).startsWith(q)) return 1;
  return 2;
}

export function get(sku: string): Hit | null {
  return load().find((r) => r.sku === sku) ?? null;
}

export function catalogueSize(): number {
  return load().length;
}
