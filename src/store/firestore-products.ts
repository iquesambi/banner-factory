import type { Enrichment } from './enrichment.js';
import type { TagStore } from './index.js';
import { adminAvailable, adminDb, whyUnavailable } from '../firebase/admin.js';

/**
 * The marketing database, in Firestore.
 *
 * The local NDJSON stays what the CLIs read and write: tagging 28,231 products
 * is a tight loop over a file, and making every step of it a network call
 * would turn a two-second job into an hour. Firestore is where the result is
 * PUBLISHED — the copy the app, and anything else later, reads.
 *
 * The document id is the SKU, and that is the whole point of this collection.
 * It is the join: the feed knows a product by its SKU and nothing else, so a
 * document keyed by SKU maps one to the other without storing a mapping. The
 * feed can be reloaded, re-exported or replaced by a live system and every
 * category, tier and verdict in here still finds its product.
 *
 * Nothing from the feed is copied in. Price, stock and the product name belong
 * to whoever owns the feed; duplicating them here would create a second
 * version of a fact that changes hourly, and the brief is explicit that what a
 * banner prints has to be true.
 */
export const PRODUCTS_COLLECTION = 'products';

/** Firestore's own limit: 500 writes per batch. */
const BATCH_LIMIT = 450;

export interface PublishReport {
  attempted: number;
  written: number;
  skipped: number;
  /** Set when nothing was written because no credential was configured. */
  unavailable: string | null;
}

/**
 * Reads which documents already exist out there and stamps them here.
 *
 * Needed once, because the publication stamp was added after a first load had
 * already written documents, and because anything could have written to the
 * collection. It reads ids only — no field data — so the cost is a listing
 * rather than a read of the shop.
 */
export async function reconcilePublished(store: TagStore): Promise<number> {
  if (!adminAvailable()) return 0;
  const at = new Date().toISOString();
  let stamped = 0;
  const docs = await adminDb().collection(PRODUCTS_COLLECTION).select().get();
  for (const doc of docs.docs) {
    if (!store.enrichment.get(doc.id)) continue;
    store.enrichment.markPublished(doc.id, at);
    stamped++;
  }
  return stamped;
}

/** What goes into one document. The SKU is the id, so it is not a field. */
function documentOf(e: Enrichment, name: string): Record<string, unknown> {
  return {
    // Kept only so a person reading the console can tell what they are looking
    // at. Never read back as a fact — the feed is the source for that.
    name,
    category: e.category,
    categoryMethod: e.categoryMethod,
    categoryDecidedBy: e.categoryDecidedBy,
    categoryPerfect: e.categoryPerfect,
    categoryAnswer: e.categoryAnswer,
    brand: e.brand,
    tier: e.tier,
    tierConfidence: e.tierConfidence,
    tierCategory: e.tierCategory,
    status: e.status,
    validatedAt: e.validatedAt,
    validatedBy: e.validatedBy,
    validationNote: e.validationNote,
    taxonomyVersion: e.taxonomyVersion,
    feedVersion: e.feedVersion,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Pushes the local marketing database to Firestore.
 *
 * `only` limits it to a set of SKUs, which is what the lazy paths use: a run
 * that validates forty products publishes forty documents rather than
 * republishing the shop. With no filter it publishes everything the rules or a
 * model have actually decided — a product nobody has looked at yet has nothing
 * to say and is left out.
 */
export async function publishProducts(
  store: TagStore,
  options: {
    only?: string[];
    /** Most documents to write in this call, for topping the mirror up in slices. */
    limit?: number;
    /** Write even records whose content was already published unchanged. */
    force?: boolean;
    onProgress?: (written: number, total: number) => void;
  } = {},
): Promise<PublishReport> {
  const report: PublishReport = { attempted: 0, written: 0, skipped: 0, unavailable: null };

  /**
   * By default only what the mirror still owes: a record is pending until the
   * exact content it holds has been written, and any change clears that. So a
   * run that is interrupted, or one over an unchanged catalogue, both do the
   * right thing without anyone tracking where they got to.
   */
  const wanted = options.only ? new Set(options.only) : null;
  let records = wanted
    ? store.enrichment.all().filter((e) => wanted.has(e.sku))
    : store.enrichment.pendingPublish();
  if (wanted && !options.force) records = records.filter((e) => e.publishedAt === null);
  if (options.limit !== undefined) records = records.slice(0, options.limit);
  report.attempted = records.length;

  if (!adminAvailable()) {
    report.unavailable = whyUnavailable();
    report.skipped = records.length;
    return report;
  }

  const db = adminDb();
  const collection = db.collection(PRODUCTS_COLLECTION);

  for (let start = 0; start < records.length; start += BATCH_LIMIT) {
    const slice = records.slice(start, start + BATCH_LIMIT);
    const batch = db.batch();
    for (const e of slice) {
      const product = store.get(e.sku);
      // A document whose SKU is no longer in the feed would be a mapping to
      // nothing, so it is not written.
      if (!product) { report.skipped++; continue; }
      batch.set(collection.doc(e.sku), documentOf(e, product.name), { merge: true });
      report.written++;
    }
    await batch.commit();
    // Stamped only after the commit returned, so a failed batch stays owed.
    const at = new Date().toISOString();
    for (const e of slice) store.enrichment.markPublished(e.sku, at);
    options.onProgress?.(report.written, records.length);
  }

  return report;
}
