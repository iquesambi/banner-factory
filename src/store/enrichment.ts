import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TaggedProduct } from '../types.js';

/**
 * The marketing database: everything this project infers about a product.
 *
 * Until now the feed's own values and our inferences lived in one file, which
 * worked only because the feed is a CSV we own a copy of. The moment the feed
 * is a live system — a product database, an API, someone else's service — that
 * arrangement is wrong in a way that is hard to undo: a tagging run would be
 * writing categories, tiers and validation flags into a system of record that
 * belongs to another team.
 *
 * So the two are split by who owns them. The feed side is READ-ONLY and can be
 * replaced by a live source without touching anything here. This side is ours:
 * category, brand, premium tier, how each was decided and when. It is keyed by
 * SKU and by nothing else, so it survives the feed being reloaded, re-exported
 * or moved behind a network call.
 *
 * `TaggedProduct` stays the merged view the rest of the code reads, because
 * nothing downstream should have to know which half a field came from.
 */
export interface Enrichment {
  sku: string;

  brand: string | null;
  category: string | null;
  categoryScore: number | null;
  categoryMargin: number | null;
  categoryMethod: TaggedProduct['categoryMethod'];
  categoryCandidates: string[];
  /**
   * How the category was settled, which is a different question from which
   * rule matched: a rule can fire and still be overruled.
   */
  categoryDecidedBy: 'rule' | 'confirmed' | 'corrected' | 'asked' | null;
  /** Whole-word match with nothing tying against it: never worth asking about. */
  categoryPerfect: boolean | null;
  /** What the model said in its own words, before it was matched back to the tree. */
  categoryAnswer: string | null;

  tier: TaggedProduct['tier'];
  tierConfidence: TaggedProduct['tierConfidence'];
  tierBy: string | null;
  tierAt: string | null;
  tierCategory: string | null;

  status: TaggedProduct['status'];
  validatedAt: string | null;
  validatedBy: string | null;
  validationNote: string | null;
  autoCategory: string | null;

  taxonomyVersion: string;
  feedVersion: string;

  /**
   * When this exact content was mirrored to Firestore, or null if it has not
   * been — including when it was published and has since CHANGED.
   *
   * `put` clears it on any real change, so the field means "the copy out
   * there matches this record" and nothing weaker. That is what lets the
   * mirror be resumable: whatever is still null is whatever is still owed,
   * however the last run ended.
   */
  publishedAt: string | null;
}

/**
 * The field names, in one place, because three things need to agree on them:
 * what gets written to the marketing file, what gets stripped from the feed
 * file, and what gets read back. Keeping them as data rather than three
 * hand-written lists is what stops a new field from being saved in one place
 * and lost in another.
 */
export const ENRICHMENT_KEYS = [
  'brand', 'category', 'categoryScore', 'categoryMargin', 'categoryMethod',
  'categoryCandidates', 'categoryDecidedBy', 'categoryPerfect', 'categoryAnswer',
  'tier', 'tierConfidence', 'tierBy', 'tierAt', 'tierCategory',
  'status', 'validatedAt', 'validatedBy', 'validationNote', 'autoCategory',
  'taxonomyVersion', 'feedVersion', 'publishedAt',
] as const satisfies ReadonlyArray<keyof Enrichment>;

export function enrichmentOf(p: TaggedProduct): Enrichment {
  const out = { sku: p.sku } as Enrichment;
  for (const key of ENRICHMENT_KEYS) {
    // The merged view is the source; a field absent from an older record
    // simply arrives undefined and is normalised on the way back out.
    (out as unknown as Record<string, unknown>)[key] =
      (p as unknown as Record<string, unknown>)[key];
  }
  return normalise(out);
}

/** Fills in fields added after a record was written, so no reader has to guess. */
export function normalise(e: Partial<Enrichment> & { sku: string }): Enrichment {
  return {
    sku: e.sku,
    brand: e.brand ?? null,
    category: e.category ?? null,
    categoryScore: e.categoryScore ?? null,
    categoryMargin: e.categoryMargin ?? null,
    categoryMethod: e.categoryMethod ?? null,
    categoryCandidates: e.categoryCandidates ?? [],
    /**
     * Records written before this field existed still say how they were
     * decided, in `categoryMethod`: a rule kind means a rule settled it, and
     * `llm` means a model did. Deriving it is reading what is there, not
     * inventing it, and it keeps the old 28,231 records countable.
     */
    categoryDecidedBy:
      e.categoryDecidedBy ??
      (e.categoryMethod === null || e.categoryMethod === undefined
        ? null
        : e.categoryMethod === 'llm'
          ? 'corrected'
          : 'rule'),
    categoryPerfect: e.categoryPerfect ?? null,
    categoryAnswer: e.categoryAnswer ?? null,
    tier: e.tier ?? null,
    tierConfidence: e.tierConfidence ?? null,
    tierBy: e.tierBy ?? null,
    tierAt: e.tierAt ?? null,
    tierCategory: e.tierCategory ?? null,
    status: e.status ?? 'unresolved',
    validatedAt: e.validatedAt ?? null,
    validatedBy: e.validatedBy ?? null,
    validationNote: e.validationNote ?? null,
    autoCategory: e.autoCategory ?? null,
    taxonomyVersion: e.taxonomyVersion ?? '',
    feedVersion: e.feedVersion ?? '',
    publishedAt: e.publishedAt ?? null,
  };
}

/** Everything except the bookkeeping about publication. */
function content(e: Enrichment): string {
  const { publishedAt, ...rest } = e;
  void publishedAt;
  return JSON.stringify(rest);
}

export interface MarketingMeta {
  /** When this side was last written, independently of the feed's own version. */
  writtenAt: string;
  records: number;
  /** The feed the enrichment was computed against, for staleness checks. */
  feedVersion: string;
  taxonomyVersion: string;
}

const DEFAULT_DIR = '.cache/marketing';

/**
 * NDJSON on disk, same as the feed side: greppable and diffable at this size.
 * Swapping it for Firestore touches this class and nothing else.
 */
export class MarketingStore {
  private records = new Map<string, Enrichment>();
  private meta: MarketingMeta | null = null;

  constructor(private dir = DEFAULT_DIR) {}

  private get path() { return `${this.dir}/enrichment.ndjson`; }
  private get metaPath() { return `${this.dir}/meta.json`; }

  exists() { return existsSync(this.path); }

  load(): this {
    this.records.clear();
    if (!existsSync(this.path)) return this;
    for (const line of readFileSync(this.path, 'utf8').split('\n')) {
      if (!line) continue;
      const e = normalise(JSON.parse(line) as Partial<Enrichment> & { sku: string });
      this.records.set(e.sku, e);
    }
    if (existsSync(this.metaPath)) {
      this.meta = JSON.parse(readFileSync(this.metaPath, 'utf8')) as MarketingMeta;
    }
    return this;
  }

  save(meta?: Partial<MarketingMeta>): this {
    mkdirSync(dirname(this.path), { recursive: true });
    const lines = [...this.records.values()].map((e) => JSON.stringify(e));
    writeFileSync(this.path, lines.length ? lines.join('\n') + '\n' : '');
    const next: MarketingMeta = {
      writtenAt: new Date().toISOString(),
      records: this.records.size,
      feedVersion: meta?.feedVersion ?? this.meta?.feedVersion ?? '',
      taxonomyVersion: meta?.taxonomyVersion ?? this.meta?.taxonomyVersion ?? '',
    };
    writeFileSync(this.metaPath, JSON.stringify(next, null, 2));
    this.meta = next;
    return this;
  }

  get(sku: string) { return this.records.get(sku); }
  /**
   * Storing a record that differs from the one already held clears its
   * publication stamp, because the copy in Firestore no longer matches it.
   * Storing an identical one leaves the stamp alone, so re-running a tagging
   * pass over an unchanged catalogue costs no writes at all.
   */
  put(e: Enrichment) {
    const next = normalise(e);
    const prev = this.records.get(next.sku);
    if (prev && content(prev) !== content(next)) next.publishedAt = null;
    else if (prev) next.publishedAt = next.publishedAt ?? prev.publishedAt;
    this.records.set(next.sku, next);
    return this;
  }

  /** Marks a record as mirrored, without touching anything else about it. */
  markPublished(sku: string, at: string) {
    const e = this.records.get(sku);
    if (e) e.publishedAt = at;
    return this;
  }

  /** What the mirror still owes: decided, and not published as it now stands. */
  pendingPublish(): Enrichment[] {
    return [...this.records.values()].filter(
      (e) => e.categoryDecidedBy !== null && e.publishedAt === null,
    );
  }
  all() { return [...this.records.values()]; }
  get size() { return this.records.size; }
  get metadata() { return this.meta; }

  /** How each product's category was arrived at, for the tagging report. */
  decidedCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.records.values()) {
      const key = e.categoryDecidedBy ?? 'none';
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }
}
