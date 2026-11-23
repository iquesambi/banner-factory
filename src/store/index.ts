import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StoreMeta, TaggedProduct } from '../types.js';

const DEFAULT_DIR = '.cache/store';

/**
 * NDJSON on disk: greppable, diff-able, and good enough at this size.
 * A database is optional for this challenge; swapping this file for one
 * only touches this module.
 */
export class TagStore {
  private products = new Map<string, TaggedProduct>();
  private meta: StoreMeta | null = null;

  constructor(private dir = DEFAULT_DIR) {}

  private get productsPath() { return `${this.dir}/products.ndjson`; }
  private get metaPath() { return `${this.dir}/meta.json`; }

  exists() { return existsSync(this.productsPath) && existsSync(this.metaPath); }

  load(): this {
    if (!this.exists()) throw new Error(`No store at ${this.dir} — run \`npm run tag\` first`);
    this.meta = JSON.parse(readFileSync(this.metaPath, 'utf8')) as StoreMeta;
    this.products.clear();
    const text = readFileSync(this.productsPath, 'utf8');
    for (const line of text.split('\n')) {
      if (!line) continue;
      const p = JSON.parse(line) as TaggedProduct;
      this.products.set(p.sku, p);
    }
    return this;
  }

  save(meta: StoreMeta): this {
    mkdirSync(dirname(this.productsPath), { recursive: true });
    const lines = [...this.products.values()].map((p) => JSON.stringify(p));
    writeFileSync(this.productsPath, lines.join('\n') + '\n');
    writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
    this.meta = meta;
    return this;
  }

  replaceAll(products: TaggedProduct[]): this {
    this.products.clear();
    for (const p of products) this.products.set(p.sku, p);
    return this;
  }

  get(sku: string) { return this.products.get(sku); }
  put(p: TaggedProduct) { this.products.set(p.sku, p); return this; }
  all() { return [...this.products.values()]; }
  get size() { return this.products.size; }
  get metadata() { return this.meta; }

  /**
   * Validation is only trustworthy against the taxonomy and feed it was made
   * with. If either moved, the flag is stale and the product needs rechecking.
   */
  needsValidation(p: TaggedProduct, taxonomyVersion: string, feedVersion: string) {
    if (p.taxonomyVersion !== taxonomyVersion || p.feedVersion !== feedVersion) return true;
    return p.status === 'auto' || p.status === 'unresolved' || p.status === 'raw';
  }

  /** Everything filed under one category path. */
  byCategory(path: string) {
    return [...this.products.values()].filter((p) => p.category === path);
  }

  /**
   * A tier is only comparable inside the category it was judged in, so a
   * product whose category moved needs a new one even though it has a value.
   */
  needsTier(p: TaggedProduct) {
    // Loose null check on purpose: records written before tier existed have
    // the field absent, not null, and those need a tier just the same.
    if (p.tier === null || p.tier === undefined) return true;
    return p.tierCategory !== p.category;
  }

  statusCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.products.values()) out[p.status] = (out[p.status] ?? 0) + 1;
    return out;
  }
}
