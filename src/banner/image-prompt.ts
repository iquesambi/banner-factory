/**
 * The banner brief, written out as a prompt for an image model.
 *
 * Built from the same brief the HTML renderer uses, so the two cannot drift:
 * the copy, the price, the badges and the brand values are read from one
 * place. Nothing here is typed by hand per banner.
 *
 * Two modes, and the difference matters for truth rather than for taste:
 *
 *   full   the model draws the whole banner, text included. One image, no
 *          compositing — and every number on it was drawn by a model that
 *          has no idea what a krone is.
 *   scene  the model draws only the background and the product lighting, and
 *          the text, price and badges are laid over it by the renderer, where
 *          they come from the feed and cannot be wrong.
 */
import {
  CANVAS, CTA_DEPTH, MARGIN, PALETTE, ZONES,
  priceText, type ArtDirectorBrief,
} from './brief.js';
import { BEFORE_WORD, SAVE_WORD, type Language } from './facts.js';
import type { ArtDirection } from '../mastra/agents/art-director.js';

export type ImagePromptMode = 'full' | 'scene';

const LANGUAGE_NOTE: Record<Language, string> = {
  da: 'Danish, including the characters æ ø å',
  sv: 'Swedish, including the characters ä ö å',
  en: 'English',
};

/** The badge, written as the banner should show it. */
function badgeLine(
  b: ArtDirectorBrief['badges'][number],
  language: Language,
): string {
  if (b.kind === 'energy') {
    return `EU energy label, class ${b.value}: a coloured arrow POINTING LEFT with the class letter in white — the shape narrows to a point on its left edge and is flat on its right edge — and immediately to its right a small white box reading A at the top, an up arrow, G at the bottom. About 170 by 112 pixels.`;
  }
  if (b.kind === 'saving' && b.amount !== undefined) {
    return `A solid yellow ${PALETTE.yellow} bar with dark navy text reading exactly "${SAVE_WORD[language]} ${priceText(b.amount)}". About 330 by 75 pixels.`;
  }
  if (b.kind === 'oldPrice' && b.amount !== undefined) {
    return `A small white line under the price reading exactly "${BEFORE_WORD[language]} ${priceText(b.amount)}".`;
  }
  if (b.kind === 'clearance') {
    return `A solid pink ${PALETTE.pink} circle about 196 pixels across, white text reading exactly "${b.value}".`;
  }
  return `A solid yellow ${PALETTE.yellow} bar with dark navy text reading exactly "${b.value}".`;
}

export function imagePrompt(
  brief: ArtDirectorBrief,
  direction: ArtDirection,
  mode: ImagePromptMode = 'full',
): string {
  const p = PALETTE;
  const L: string[] = [];
  const lang = brief.language;

  L.push(
    `Produce a retail hero banner for Elgiganten, the Nordic electronics retailer, exactly ${CANVAS.width} by ${CANVAS.height} pixels.`,
  );
  L.push('');

  L.push('## The product photograph');
  L.push(
    'The attached photograph is the product. Use it as it is: do not redraw it, do not restyle it, do not replace it with something that looks similar, and do not change its colour, its proportions or any lettering on it. Cut it out of its white background and place it on the banner. It must be whole — never cropped by the edge of the canvas — with clear space above and below it.',
  );
  L.push(`Product: ${brief.product.name}.`);
  L.push('');

  L.push('## Brand');
  L.push(`Background: one smooth navy gradient across the whole canvas, with no visible edge, seam, facet or band anywhere in it. The top left corner and the bottom right corner are ${p.navyLight}; the top right corner and the bottom left corner are ${p.navyDark}; everything between them shades gradually. No pattern, no texture, no vignette.`);
  L.push(`Brand green: ${p.green}. Deep green, used only for the button's shadow: ${p.greenDeep}. Pink: ${p.pink}. Yellow: ${p.yellow}. Text white: ${p.white}.`);
  L.push('Typefaces: a condensed heavy grotesque for the headline and the price, set in capitals; a clean humanist sans for the supporting line and the small text. No serifs anywhere, no script, no outlines, no gradients on type.');
  L.push('No logo anywhere on the banner. No watermark, no signature, no border, no frame.');
  L.push('');

  L.push('## Layout');
  L.push(`A clear margin of ${MARGIN} pixels on every side. Nothing crosses it except the small print.`);
  L.push(`Left band, from x=${ZONES.text.x} to x=${ZONES.text.x + ZONES.text.width}: the headline, the supporting line and the button, as one group, vertically centred.`);
  L.push(`Middle band, from x=${ZONES.product.x} to x=${ZONES.product.x + ZONES.product.width}: the product, vertically centred, filling ${direction.productScale === 'fill' ? 'as much of the height as the margins allow' : `a ${direction.productScale} share of the band`}.`);
  L.push(`Right band, from x=${ZONES.side.x} to x=${ZONES.side.x + ZONES.side.width}: the badges and the price, left aligned, vertically centred.`);
  L.push('');

  if (mode === 'scene') {
    L.push('## What to draw, and what to leave out');
    L.push('Draw ONLY the background and the product, lit and placed as described. Leave the left band and the right band completely empty — no text, no price, no badges, no button. Those are composited afterwards and anything drawn there will be covered or will clash.');
    return L.join('\n');
  }

  L.push('## The text, which must be copied exactly');
  L.push(
    `Every string below is to be reproduced character for character, in ${LANGUAGE_NOTE[lang]}. Do not translate, do not rephrase, do not correct, do not shorten, do not add a word, and do not add punctuation. Digits especially: these are real prices and a wrong digit is a false advertisement.`,
  );
  L.push('');
  L.push('HEADLINE — capitals, the largest text on the banner, set over these lines exactly as broken here:');
  direction.headlineLines.forEach((l, i) => L.push(`  line ${i + 1}: ${l.toUpperCase()}`));
  L.push(
    `  The words "${brief.copy.accent}" inside the headline are set in the brand green ${p.green}. Every other word of the headline is white.`,
  );
  L.push('');
  L.push(`SUPPORTING LINE — sentence case, white, well below the headline in size:`);
  L.push(`  ${brief.copy.support}`);
  L.push('');
  L.push('BUTTON — a green pill below the supporting line:');
  L.push(
    `  Text: ${brief.copy.cta}. Dark navy ${p.navyDark} text on a ${p.green} pill, fully rounded ends. A second pill in ${p.greenDeep} sits exactly ${CTA_DEPTH} pixels below and ${CTA_DEPTH} pixels to the right of it, behind it, giving a hard offset shadow with no blur and no gradient.`,
  );
  L.push('');
  L.push('PRICE — the largest thing in the right band, white, capitals:');
  L.push(`  ${brief.product.priceText}`);
  L.push('');

  if (brief.badges.length) {
    L.push('BADGES in the right band, in this order from the top:');
    brief.badges.forEach((b, i) => L.push(`  ${i + 1}. ${badgeLine(b, lang)}`));
    /** Only describe the spacing between badges that are actually there. */
    const hasBar = brief.badges.some((b) => b.kind !== 'energy' && b.kind !== 'oldPrice' && b.kind !== 'clearance');
    const hasEnergy = brief.badges.some((b) => b.kind === 'energy');
    if (hasBar) {
      L.push('  The yellow bar sits tight above the price, about 20 pixels clear of it.');
    }
    if (hasEnergy) {
      L.push(
        hasBar
          ? '  The energy label sits well above the yellow bar, about 46 pixels clear of it.'
          : '  The energy label sits well above the price, about 46 pixels clear of it.',
      );
    }
    L.push('');
  }

  L.push('PRODUCT NAME — small, white, semibold, directly under the price:');
  L.push(`  ${brief.product.name}`);
  L.push('');

  if (brief.finePrint) {
    L.push('SMALL PRINT — one line along the very bottom, small, white, centred:');
    L.push(`  ${brief.finePrint}`);
    L.push('');
  }

  if (brief.mustNotContradict.length) {
    L.push('## Conditions the banner must not contradict');
    for (const c of brief.mustNotContradict) L.push(`- ${c}`);
    L.push('');
  }

  L.push('## Do not');
  L.push('- Do not invent any price, saving, percentage, date, claim or word that is not written above.');
  L.push('- Do not add badges, stickers, starbursts, arrows, ribbons or urgency of any kind.');
  L.push('- Do not add people, hands, rooms, furniture or props. The product sits on the gradient alone.');
  L.push('- Do not add a reflection, a drop shadow or a glow under the product.');
  L.push(
    `- Do not letterbox, pad or crop the canvas. The output must be exactly ${CANVAS.width} pixels wide and ${CANVAS.height} pixels tall, not merely close to it.`,
  );
  L.push('- Do not put a hard edge, seam, facet or colour block in the background. It is one continuous gradient.');

  return L.join('\n');
}
