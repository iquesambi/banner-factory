import type { RawProduct, TaggedProduct } from '../types.js';
import type { Taxonomy } from '../taxonomy/index.js';
import { derive } from '../feed/load.js';
import { CategoryTagger, brandFromName } from './category.js';

export { CategoryTagger, brandFromName };

export interface TagCatalogResult {
  products: TaggedProduct[];
  tagger: CategoryTagger;
  stats: {
    total: number;
    withBrand: number;
    withCategory: number;
    unresolved: number;
    byDepartment: Record<string, number>;
    byMethod: Record<string, number>;
  };
}

/**
 * The zero-cost pass: deterministic brand + category for the whole base.
 * No model is called here, so re-running it on a new feed is free.
 */
export function tagCatalog(
  raw: RawProduct[],
  taxonomy: Taxonomy,
  feedVersion: string,
): TagCatalogResult {
  const names = raw.map((r) => r['product-name'] ?? '');
  const tagger = new CategoryTagger(taxonomy).fit(names);

  const byDepartment: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  let withBrand = 0;
  let withCategory = 0;

  const products = raw.map((r): TaggedProduct => {
    const name = r['product-name'] ?? '';
    const facts = derive(r);
    const guess = tagger.tag(name);
    const brand = brandFromName(name, taxonomy);

    if (brand) withBrand++;
    if (guess) {
      withCategory++;
      byDepartment[guess.path.split('/')[0]!] = (byDepartment[guess.path.split('/')[0]!] ?? 0) + 1;
      byMethod[guess.kind] = (byMethod[guess.kind] ?? 0) + 1;
    }

    return {
      sku: r.SKU,
      name,
      ...facts,
      brand,
      category: guess?.path ?? null,
      categoryScore: guess?.score ?? null,
      categoryMargin: guess?.margin ?? null,
      categoryMethod: guess?.kind ?? null,
      categoryCandidates: guess?.candidates ?? [],
      status: guess ? 'auto' : 'unresolved',
      validatedAt: null,
      validatedBy: null,
      validationNote: null,
      autoCategory: guess?.path ?? null,
      taxonomyVersion: taxonomy.version,
      feedVersion,
    };
  });

  return {
    products,
    tagger,
    stats: {
      total: products.length,
      withBrand,
      withCategory,
      unresolved: products.length - withCategory,
      byDepartment,
      byMethod,
    },
  };
}
