/**
 * What is true about a product, and what the banner is therefore allowed to say.
 *
 * This file is the truth layer, and it is deliberately code and not prompt.
 * The brief requires that everything in the banner be true — the product, the
 * price and the saving come from the feed and are never invented — and a
 * requirement that admits no exception does not belong in a text a model can
 * reinterpret. The same split the business rules use: what must be true is
 * code, what needs judgement is prompt.
 *
 * So nothing here decides whether a badge is a good idea. It decides whether
 * the badge is permitted to exist. The strategist chooses from what survives.
 */
import type { TaggedProduct } from '../types.js';

export type Language = 'da' | 'sv' | 'en';

export const LANGUAGE_NAMES: Record<Language, string> = {
  da: 'Danish',
  sv: 'Swedish',
  en: 'English',
};

/**
 * The button text, as a closed set per language.
 *
 * Free text here produced a Danish button on an English banner, which no
 * instruction reliably prevents and no general language check would catch. A
 * short list does, and the call to action is the one slot where a fixed
 * vocabulary costs nothing: it carries no product fact and the brand repeats
 * the same few words across every banner anyway.
 *
 * The Danish entries and "Klicka här" are lifted from the production banners
 * in `examples/`. The rest are drafts and want a native speaker's eye before
 * this goes anywhere real.
 */
export const CTA_OPTIONS: Record<Language, string[]> = {
  da: ['Se tilbud', 'Køb nu', 'Læs mere'],
  sv: ['Klicka här', 'Se erbjudandet', 'Köp nu', 'Läs mer'],
  en: ['See offer', 'Buy now', 'Read more', 'Shop now'],
};

/**
 * The closed set of extras the banner can carry, taken from the eight
 * production banners rather than invented. Anything not on this list has no
 * design for it, so offering it would produce copy the art director cannot
 * place.
 */
export type BadgeKind =
  | 'energy'
  | 'saving'
  | 'oldPrice'
  | 'clearance'
  | 'multibuy'
  | 'warranty'
  | 'memberPrice';

export const BADGE_LABELS: Record<BadgeKind, string> = {
  energy: 'EU energy label',
  saving: 'savings badge',
  oldPrice: 'previous price beside the current one',
  clearance: 'end-of-line badge',
  multibuy: 'multi-buy mechanic',
  warranty: 'extended warranty',
  memberPrice: 'member price',
};

export interface Badge {
  kind: BadgeKind;
  /** The literal truth it would show, already formatted. */
  value: string;
  /** Which feed field it comes from, so a reviewer can check it. */
  source: string;
  /** A condition the banner must state if this badge is used, if any. */
  requires: string | null;
}

export interface BlockedBadge {
  kind: BadgeKind;
  /** Why the data does not support it. Written for a human reading a report. */
  why: string;
}

export interface BannerFacts {
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  language: Language;
  /** Always in DKK: the feed is Elgiganten DK and language changes text, not market. */
  price: number;
  stockBand: string;
  image: string | null;
  /** Badges the data supports. The strategist picks from exactly this list. */
  available: Badge[];
  /** Badges the data hints at but truth forbids. Kept so the run can explain itself. */
  blocked: BlockedBadge[];
  /**
   * Conditions attached to this product that the banner must not contradict,
   * whatever the copy says. These are facts, not preferences.
   */
  restrictions: string[];
  /** Every number the copy is allowed to contain, as written. */
  allowedNumbers: string[];
}

/** `SPAR 750`, `Rest SPAR 82`, `Rest SPAR 22,95`. */
const SPAR = /^(?:rest\s+)?spar\s+([0-9.,]+)$/i;

function parseSpar(salesPoint: string | null): number | null {
  if (!salesPoint) return null;
  const m = SPAR.exec(salesPoint.trim());
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** `Klubpris 1499` — the number is a SECOND, lower price, not this product's price. */
function parseKlubpris(salesPoint: string | null): number | null {
  if (!salesPoint) return null;
  const m = /klubpris\s+([0-9.,]+)/i.exec(salesPoint);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** `Maks 3`, `Maks. 1 stk. pr. kunde`, `Maks 2 per kunde`. */
function parseLimit(salesPoint: string | null): string | null {
  if (!salesPoint) return null;
  const m = /maks\.?\s*([0-9]+)/i.exec(salesPoint);
  return m?.[1] ? `at most ${m[1]} per customer` : null;
}

/** `5 års garanti*`, `7 Års Garanti`. */
function parseWarranty(salesPoint: string | null): string | null {
  if (!salesPoint) return null;
  const m = /([0-9]+)\s*års?\s*garanti/i.exec(salesPoint);
  return m?.[1] ? `${m[1]} years` : null;
}

/**
 * Whether the feed agrees with itself about the saving.
 *
 * Measured on this catalogue: of the products whose SalesPoint states `SPAR n`,
 * 1,560 match SavePriceAmount and 56 do not, and in three of those the previous
 * price is BELOW the current one. Where the feed contradicts itself there is no
 * way to pick the honest number, so the saving is not shown at all.
 */
function savingIsTrustworthy(p: TaggedProduct): { ok: boolean; why: string } {
  /**
   * Order matters here only for the message. A product whose previous price is
   * below its current one also has a negative saving, and "the price went up"
   * is the fact worth reporting; "no saving" would be true and useless.
   */
  if (p.oldPrice !== null && p.oldPrice <= p.price) {
    return {
      ok: false,
      why: `the feed's previous price (${p.oldPrice} kr) is not above the current one (${p.price} kr), so there is no saving to show`,
    };
  }
  if (p.saveAmount === null || p.saveAmount <= 0) {
    return { ok: false, why: 'the feed states no saving for this product' };
  }
  if (p.oldPrice === null) {
    return { ok: false, why: 'there is no previous price to measure the saving against' };
  }
  const spar = parseSpar(p.salesPoint);
  if (spar !== null && Math.abs(spar - p.saveAmount) >= 1) {
    return {
      ok: false,
      why: `the feed disagrees with itself: the label says ${spar} and the saving field says ${p.saveAmount}`,
    };
  }
  return { ok: true, why: '' };
}

/**
 * Build the permitted set for one product in one language.
 *
 * Reads only the feed values carried on the product. It never asks a model
 * anything, never fails, and is cheap enough to run before deciding whether a
 * banner is worth making at all.
 */
export function buildFacts(p: TaggedProduct, language: Language): BannerFacts {
  const available: Badge[] = [];
  const blocked: BlockedBadge[] = [];
  const restrictions: string[] = [];
  const sp = p.salesPoint;

  // --- energy label
  if (p.energyClass) {
    available.push({
      kind: 'energy',
      value: p.energyClass,
      source: 'EnergyEfficiencyClass',
      requires: null,
    });
  }

  // --- saving, and the previous price that justifies it
  const saving = savingIsTrustworthy(p);
  if (saving.ok && p.saveAmount !== null && p.oldPrice !== null) {
    available.push({
      kind: 'saving',
      value: `${p.saveAmount} kr${p.discountPct > 0 ? ` (${p.discountPct}%)` : ''}`,
      source: 'SavePriceAmount',
      requires: null,
    });
    available.push({
      kind: 'oldPrice',
      value: `${p.oldPrice} kr`,
      source: 'Price + SavePriceAmount',
      requires: null,
    });
  } else {
    blocked.push({ kind: 'saving', why: saving.why });
    blocked.push({ kind: 'oldPrice', why: saving.why });
  }

  // --- member price
  const klub = parseKlubpris(sp);
  if (klub !== null) {
    /**
     * The shown price is the NON-member price; the member price lives only in
     * the label text. Showing the lower number as the price would mislead
     * everyone who is not a member, so the badge exists but carries its
     * condition with it.
     */
    available.push({
      kind: 'memberPrice',
      value: `${klub} kr for members`,
      source: 'SalesPoint',
      requires: 'the banner must say this price is for members',
    });
    restrictions.push(
      `${p.price} kr is the price without membership; ${klub} kr is the member price and may never be shown as the plain price`,
    );
  }

  // --- end of line
  if (sp && /^rest/i.test(sp.trim())) {
    available.push({ kind: 'clearance', value: sp.trim(), source: 'SalesPoint', requires: null });
  }

  // --- multi-buy
  if (sp && /betal for/i.test(sp)) {
    available.push({ kind: 'multibuy', value: sp.trim(), source: 'SalesPoint', requires: null });
  }

  // --- extended warranty
  const warranty = parseWarranty(sp);
  if (warranty) {
    available.push({
      kind: 'warranty',
      value: warranty,
      source: 'SalesPoint',
      /** Every warranty line in this feed carries an asterisk; so must the banner. */
      requires: 'terms apply, so the banner must carry the asterisk',
    });
  }

  // --- restrictions that no badge choice can undo
  const limit = parseLimit(sp);
  if (limit) restrictions.push(`purchase is limited to ${limit}`);
  if (sp && /pant/i.test(sp)) restrictions.push('the price does not include the deposit');
  if (sp && /frontplade/i.test(sp)) restrictions.push('the product ships without a front plate');

  /**
   * Every number the copy may contain. The check after the model compares the
   * digits in the generated text against this list, which turns "never invent a
   * price" from an instruction into something verifiable.
   */
  const allowedNumbers = [String(p.price)];
  if (saving.ok && p.saveAmount !== null && p.oldPrice !== null) {
    allowedNumbers.push(String(p.saveAmount), String(p.oldPrice), String(p.discountPct));
  }
  if (klub !== null) allowedNumbers.push(String(klub));
  // Numbers that are part of the product's own name are true by definition.
  for (const n of p.name.match(/\d+/g) ?? []) allowedNumbers.push(n);

  return {
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: p.category,
    language,
    price: p.price,
    stockBand: p.stockBand,
    image: p.image,
    available,
    blocked,
    restrictions,
    allowedNumbers: [...new Set(allowedNumbers)],
  };
}

/**
 * Numbers in the copy that no fact supports.
 *
 * Deliberately narrow: it only looks at runs of digits, so it catches an
 * invented price or saving, which is the failure the brief cares about. A
 * single digit is ignored because "2 in 1" and "4K" are language, not claims.
 */
export function unsupportedNumbers(text: string, facts: BannerFacts): string[] {
  const found = text.match(/\d[\d.,]*/g) ?? [];
  const bad: string[] = [];
  for (const raw of found) {
    const digits = raw.replace(/[.,]$/, '');
    if (digits.length < 2) continue;
    const plain = digits.replace(/[.,]/g, '');
    const ok = facts.allowedNumbers.some((a) => a.replace(/[.,]/g, '') === plain);
    if (!ok) bad.push(digits);
  }
  return [...new Set(bad)];
}
