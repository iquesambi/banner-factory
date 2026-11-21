/** Raw feed record: 18 string fields, exactly as Elgiganten ships it. */
export interface RawProduct {
  'product-name': string;
  SKU: string;
  Price: string;
  SalePrice: string;
  SavePriceAmount: string;
  Image: string;
  AdditionalImageUrls: string;
  DescriptionShort: string;
  DescriptionLong: string;
  Bulletpoint1: string;
  Bulletpoint2: string;
  Bulletpoint3: string;
  SalesPoint: string;
  StockLevelEcomFormat: string;
  EnergyLabelUrl: string;
  EnergyEfficiencyClass: string;
  EnergyArrowUrlPng: string;
  EnergyArrowUrlSvg: string;
}

/**
 * Where a product sits in the progressive cleaning pipeline.
 *
 *  raw        never tagged
 *  auto       deterministic tagger produced a category, no model has seen it
 *  unresolved deterministic tagger found nothing to anchor on
 *  validated  a model confirmed the deterministic category
 *  corrected  a model overrode the deterministic category
 */
export type TagStatus = 'raw' | 'auto' | 'unresolved' | 'validated' | 'corrected';

export interface TaggedProduct {
  sku: string;
  name: string;

  // --- feed values, carried across unmodified
  price: number;
  saveAmount: number | null;
  /** Price + SavePriceAmount, as the brief defines the previous price. */
  oldPrice: number | null;
  /** The one thing computed here: percentage off, or 0 when there is no discount. */
  discountPct: number;
  stockBand: string;
  image: string | null;
  energyClass: string | null;
  salesPoint: string | null;

  // --- tagging
  brand: string | null;
  category: string | null;
  categoryScore: number | null;
  categoryMargin: number | null;
  categoryMethod: 'synonym' | 'phrase' | 'exact' | 'compound' | 'llm' | null;
  categoryCandidates: string[];

  // --- validation state
  status: TagStatus;
  validatedAt: string | null;
  validatedBy: string | null;
  validationNote: string | null;
  /** Deterministic guess kept after a correction, so we can audit the tagger. */
  autoCategory: string | null;

  // --- provenance: a change in either invalidates validation
  taxonomyVersion: string;
  feedVersion: string;
}

export interface StoreMeta {
  feedVersion: string;
  taxonomyVersion: string;
  taggedAt: string;
  count: number;
}
