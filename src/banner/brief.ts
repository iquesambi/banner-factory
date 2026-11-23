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
    zones: typeof ZONES;
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
}

export function buildBrief(input: BriefInput): ArtDirectorBrief {
  const { facts, copy } = input;
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
      zones: ZONES,
      background: `navy gradient, ${PALETTE.navyLight} to ${PALETTE.navyDark}`,
      notes: [
        'The headline is set in the headline face, upper case, white, with the accent run in the brand green.',
        'The supporting line is sentence case, body face, white, well below the headline size.',
        'The call to action is a filled green pill with dark text, bottom of the text band.',
        'The product is cut out and sits on the navy, with no card and no drop shadow behind it.',
        'The logo goes on the navy in its white form.',
        'The fine print runs along the very bottom in the body face, small, white.',
      ],
    },
  };
}
