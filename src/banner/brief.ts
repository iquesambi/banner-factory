/**
 * Everything the art director receives, and nothing it has to go and find.
 *
 * The brief is assembled, not written by a model: every value in it either
 * comes from the feed, from the two agents that already ran, or from the brand
 * files in `brand/`. Keeping it that way means the art direction stage starts
 * from facts and from measured brand values rather than from a description of
 * them.
 *
 * The palette and the geometry below were read out of the eight production
 * banners in `examples/`, by decoding the PNGs and sampling them, not copied
 * from a description of the brand.
 */
import type { BannerFacts, Language } from './facts.js';
import type { CopyDraft } from '../mastra/agents/copywriter.js';
import type { ChosenBadge } from '../mastra/workflows/compose.js';

/** Every production banner in `examples/` is exactly this size. */
export const CANVAS = { width: 2048, height: 768 } as const;

/**
 * Sampled from the production banners.
 *
 * The background is a navy gradient rather than a flat fill; the two values
 * are its measured ends. The same green serves the headline accent and the
 * button. `energyA` is the green inside the EU label and is not a brand
 * colour — it belongs to the label artwork and is here so nobody matches the
 * button to it by mistake.
 */
export const PALETTE = {
  navyLight: '#0e2d7c',
  navyDark: '#041752',
  green: '#77be24',
  /**
   * The button is two pills, not one: a second in this darker green sits
   * about eight pixels down and to the right, which is what gives it depth.
   * Measured in `01-dk-sidste-chance` and `03-dk-ipad-tradein`.
   */
  greenDeep: '#096729',
  pink: '#ed3089',
  yellow: '#fdf100',
  white: '#ffffff',
  logoNavy: '#11175e',
  energyA: '#05a54d',
} as const;

/**
 * How far the button's shadow sits below and to the right, in pixels.
 * Measured at +10 in `01-dk-sidste-chance` and +7 in `03-dk-ipad-tradein`.
 */
export const CTA_DEPTH = 9;

export const FONTS = {
  headline: { family: 'Elkjop A Int Headline', file: 'brand/fonts/ElkjopAIntHeadline-Regular.otf' },
  body: { family: 'Elkjop A Int Bodytext', file: 'brand/fonts/ElkjopAIntBodytext-Regular.otf' },
  bodyBold: { family: 'Elkjop A Int Bodytext', file: 'brand/fonts/ElkjopAIntBodytext-DemiBold.otf' },
} as const;

/**
 * The logo files exist in `brand/`, and none of the eight production banners
 * carries one — the banner runs inside a page that already has the logo in
 * its header. An earlier version of this renderer put one in the top right
 * corner; that was my addition and it is gone.
 */
export const LOGO = {
  onNavy: 'brand/logo/elgiganten-white.svg',
  onLight: 'brand/logo/elgiganten-navy.svg',
  usedOnBanner: false,
} as const;

/**
 * The safe margin, measured off the references rather than chosen.
 *
 * In `03-dk-ipad-tradein` the text runs x 77..690 and the side band x
 * 1516..1970 — a 77 and 78 pixel margin on either side, and the same
 * vertically. Nothing but the fine print and a deliberately large product
 * goes past it.
 */
export const MARGIN = 78;

/**
 * The three bands, in pixels, as the production banners actually place them.
 *
 * These are measurements, not estimates: the product sits at x 778..1515 in
 * all three product banners, and the side band starts at x 1516 in both that
 * carry a price.
 */
export const ZONES = {
  text: { x: MARGIN, y: MARGIN, width: 612, height: CANVAS.height - MARGIN * 2 },
  product: { x: 778, y: 0, width: 737, height: CANVAS.height },
  side: { x: 1516, y: MARGIN, width: 454, height: CANVAS.height - MARGIN * 2 },
} as const;

/** A band: where it starts and how much room it has. */
export interface Band { x: number; y: number; width: number; height: number }
export interface Zones { text: Band; product: Band; side: Band }

/**
 * More than one way to place the three bands.
 *
 * The measurements above are one arrangement, and every banner this project
 * made used it, which is why they all looked like each other. The production
 * references are not that uniform: the product moves side to side and the
 * price band goes with it.
 *
 * So the bands keep their measured proportions and change places. Nothing
 * here invents a new geometry — the margin, the widths and the side band are
 * the ones taken off the real banners, mirrored or stretched, not redrawn.
 */
export type LayoutName = 'classic' | 'mirrored' | 'wide';

const GUTTER = CANVAS.width - MARGIN; // 1970: where the right edge of content sits

export const LAYOUTS: Record<LayoutName, { zones: Zones; typeScale: number; note: string }> = {
  /** As measured: text left, product centre-right, price band far right. */
  classic: {
    zones: ZONES,
    typeScale: 1,
    note: 'text on the left, product centre-right, price band on the far right',
  },

  /**
   * The same bands, mirrored. The product moves to the left of centre and the
   * copy reads down the right, which is the arrangement several of the
   * production banners use and none of ours did.
   */
  mirrored: {
    zones: {
      text: { x: GUTTER - 612, y: MARGIN, width: 612, height: CANVAS.height - MARGIN * 2 },
      product: { x: 533, y: 0, width: 737, height: CANVAS.height },
      side: { x: MARGIN, y: MARGIN, width: 454, height: CANVAS.height - MARGIN * 2 },
    },
    typeScale: 1,
    note: 'price band on the left, product centre-left, text on the right',
  },

  /**
   * Fewer, larger elements. The text band takes the room the side band would
   * have used and the type comes up with it, for a banner that carries one
   * message loudly rather than three quietly.
   */
  wide: {
    zones: {
      text: { x: MARGIN, y: MARGIN, width: 760, height: CANVAS.height - MARGIN * 2 },
      product: { x: 900, y: 0, width: 800, height: CANVAS.height },
      side: { x: 1700, y: MARGIN, width: 270, height: CANVAS.height - MARGIN * 2 },
    },
    typeScale: 1.12,
    note: 'a wider text band and a larger product, with a narrow price column',
  },
};

/**
 * Which arrangement a product gets.
 *
 * Derived from the SKU rather than chosen at random or by a model. Random
 * would mean the same product rendered differently every run, which makes a
 * banner impossible to reproduce and a reused one look like a mistake; a
 * model would cost a call to answer a question with no judgement in it. A
 * hash gives variety across products and stability for each one.
 */
export function layoutFor(sku: string): LayoutName {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) hash = (hash * 31 + sku.charCodeAt(i)) >>> 0;
  const names = Object.keys(LAYOUTS) as LayoutName[];
  return names[hash % names.length]!;
}

/**
 * How much vertical room the product gets, and the floor under it.
 *
 * Measured: the product occupies 68% to 90% of the canvas height across the
 * references, with at least 56 pixels of air above it, and in none of the
 * eight is it cropped by the edge of the canvas. An earlier version of this
 * renderer let a large product bleed off the bottom; that was my invention,
 * not something the brand does, and it read as a mistake.
 */
export const PRODUCT_BOX = { marginTop: 56, marginBottom: 56, maxFraction: 0.9 } as const;

/**
 * How each badge is drawn, taken from where it appears in the references.
 * The art director can override it; the point is that it starts from what the
 * brand actually does rather than from an invention.
 */
export const BADGE_TREATMENT: Record<string, string> = {
  energy: 'official EU energy label artwork, small, top of the side band',
  saving: 'yellow bar, dark text, side band above the price',
  oldPrice: 'small white line directly under the price',
  clearance: 'pink circle, top right',
  multibuy: 'yellow bar, dark text',
  warranty: 'yellow bar, dark text, asterisk pointing at the fine print',
  memberPrice: 'yellow bar, dark text, with the member condition on it',
};

export interface BriefBadge {
  kind: string;
  value: string;
  /** The same figure as a number, so the renderer can set it in brand style. */
  amount?: number;
  pct?: number;
  treatment: string;
  /** The strategist's sentence, kept so a human can argue with the choice. */
  reason: string;
}

export interface ArtDirectorBrief {
  canvas: typeof CANVAS;
  language: Language;
  /** What the customer had been looking at, and why it is not the answer. */
  seed: {
    sku: string;
    name: string;
    price: number;
    stockBand: string;
    unavailable: boolean;
  };
  /** How this product came to be chosen, in one word and in one sentence. */
  decision: string;
  chosenBecause: string;
  product: {
    sku: string;
    name: string;
    brand: string | null;
    price: number;
    priceText: string;
    image: string;
  };
  copy: {
    headline: string;
    /** The run of words inside the headline that is set in the accent green. */
    accent: string;
    support: string;
    cta: string;
  };
  badges: BriefBadge[];
  finePrint: string | null;
  /** Conditions the artwork must not contradict, whatever it shows. */
  mustNotContradict: string[];
  design: {
    palette: typeof PALETTE;
    fonts: typeof FONTS;
    logo: typeof LOGO;
    zones: Zones;
    /** Which arrangement of the three bands this banner uses. */
    layout: LayoutName;
    /** Multiplier on every type size, so a layout can carry larger copy. */
    typeScale: number;
    background: string;
    notes: string[];
  };
}

/**
 * Danish price style, which is what the banners show whatever the language:
 * full stop for thousands, and a trailing `,-` instead of `,00`.
 */
export function priceText(n: number): string {
  return `${Math.round(n).toLocaleString('da-DK')},-`;
}

export interface BriefInput {
  language: Language;
  seed: { sku: string; name: string; price: number; stockBand: string };
  decision: string;
  chosenBecause: string;
  facts: BannerFacts;
  copy: CopyDraft;
  show: ChosenBadge[];
  finePrint: string | null;
  /** Forces an arrangement, for comparing them side by side. */
  layout?: LayoutName;
}

export function buildBrief(input: BriefInput): ArtDirectorBrief {
  const { facts, copy } = input;
  /**
   * The arrangement is settled before anything is drawn, from the product
   * itself, so the brief the art director reads already says where the bands
   * are rather than assuming the one we always used.
   */
  const layoutName = input.layout ?? layoutFor(facts.sku);
  const layout = LAYOUTS[layoutName];
  const inStock = !['0', '', undefined].includes(input.seed.stockBand.trim());

  return {
    canvas: CANVAS,
    language: input.language,
    seed: {
      sku: input.seed.sku,
      name: input.seed.name,
      price: input.seed.price,
      stockBand: input.seed.stockBand,
      unavailable: !inStock,
    },
    decision: input.decision,
    chosenBecause: input.chosenBecause,
    product: {
      sku: facts.sku,
      name: facts.name,
      brand: facts.brand,
      price: facts.price,
      priceText: priceText(facts.price),
      // The compose workflow refuses to run without one, so this is never null here.
      image: facts.image ?? '',
    },
    copy: {
      headline: copy.headline,
      accent: copy.accent,
      support: copy.support,
      cta: copy.cta,
    },
    badges: input.show.map((s) => ({
      kind: s.badge.kind,
      value: s.badge.value,
      ...(s.badge.amount !== undefined ? { amount: s.badge.amount } : {}),
      ...(s.badge.pct !== undefined ? { pct: s.badge.pct } : {}),
      treatment: BADGE_TREATMENT[s.badge.kind] ?? 'side band',
      reason: s.reason,
    })),
    finePrint: input.finePrint,
    mustNotContradict: facts.restrictions,
    design: {
      palette: PALETTE,
      fonts: FONTS,
      logo: LOGO,
      zones: layout.zones,
      layout: layoutName,
      typeScale: layout.typeScale,
      background: `navy gradient, ${PALETTE.navyLight} to ${PALETTE.navyDark}`,
      notes: [
        'The headline is set in the headline face, upper case, white, with the accent run in the brand green.',
        'The supporting line is sentence case, body face, white, well below the headline size.',
        'The call to action is a filled green pill with dark text, bottom of the text band.',
        'The product is cut out and sits on the navy, with no card and no drop shadow behind it.',
        'The logo goes on the navy in its white form.',
        `This banner uses the ${layoutName} arrangement: ${layout.note}.`,
        'The fine print runs along the very bottom in the body face, small, white.',
      ],
    },
  };
}
