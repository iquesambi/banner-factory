import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StoreMeta, TaggedProduct } from '../types.js';
import { ENRICHMENT_KEYS, MarketingStore, enrichmentOf, normalise } from './enrichment.js';

const DEFAULT_DIR = '.cache/store';

/**
 * NDJSON on disk: greppable, diff-able, and good enough at this size.
 * A database is optional for this challenge; swapping this file for one
 * only touches this module.
 */
export class TagStore {
  private products = new Map<string, TaggedProduct>();
  private meta: StoreMeta | null = null;
  /**
   * Everything this project infers lives in its own store, so the feed side
   * can one day be a live system we only read from. `TaggedProduct` is the
   * merged view; the split happens here and nowhere else.
   */
  private marketing: MarketingStore;

  constructor(private dir = DEFAULT_DIR, marketingDir?: string) {
    this.marketing = new MarketingStore(marketingDir ?? `${dir.replace(/\/store$/, '')}/marketing`);
  }

  /** The marketing database, for callers that want to read or report on it. */
  get enrichment() { return this.marketing; }

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

    /**
     * The two halves are merged back here. A store written before the split
     * carries its enrichment inline, so the first load adopts those values and
     * writes the marketing file once; after that the feed file is only ever
     * read for feed values, and the enrichment on it is ignored.
     */
    const hadFile = this.marketing.exists();
    this.marketing.load();
    for (const p of this.products.values()) {
      const saved = this.marketing.get(p.sku);
      if (saved) {
        Object.assign(p, saved);
        continue;
      }
      if (!hadFile) this.marketing.put(enrichmentOf(p));
    }
    if (!hadFile && this.marketing.size) {
      this.marketing.save({
        feedVersion: this.meta.feedVersion,
        taxonomyVersion: this.meta.taxonomyVersion,
      });
    }
    return this;
  }

  save(meta: StoreMeta): this {
    mkdirSync(dirname(this.productsPath), { recursive: true });
    /**
     * The feed file gets feed values only. Anything we inferred is stripped on
     * the way out and written to the marketing store instead, so this file
     * stays something a live source could replace wholesale.
     */
    const lines: string[] = [];
    for (const p of this.products.values()) {
      this.marketing.put(enrichmentOf(p));
      const feedOnly: Record<string, unknown> = { ...p };
      for (const key of ENRICHMENT_KEYS) delete feedOnly[key];
      lines.push(JSON.stringify(feedOnly));
    }
    writeFileSync(this.productsPath, lines.join('\n') + '\n');
    writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
    this.marketing.save({
      feedVersion: meta.feedVersion,
      taxonomyVersion: meta.taxonomyVersion,
    });
    this.meta = meta;
    return this;
  }

  replaceAll(products: TaggedProduct[]): this {
    this.products.clear();
    for (const p of products) this.products.set(p.sku, p);
    return this;
  }

  get(sku: string) { return this.products.get(sku); }
  /** Reading a product gives the merged view; writing one splits it again. */
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
    if (p.status === 'unresolved' || p.status === 'raw') return true;
    /**
     * A perfect fit is not asked about, ever. The rule matched a whole word of
     * the name and no other category tied with it, so there is no question for
     * a model to answer and the call would be spent confirming what the name
     * already says. Measured on this catalogue that is 12,832 products —
     * nearly half the shop never reaching a model at all.
     *
     * Everything else the rules placed is a guess worth one yes-or-no, and it
     * is asked HERE, when the category is actually touched by a run, rather
     * than in a pass over the whole shop. Most categories are never touched.
     */
    if (p.status === 'auto') return p.categoryPerfect !== true;
    return false;
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
