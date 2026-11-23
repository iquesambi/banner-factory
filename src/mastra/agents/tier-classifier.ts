import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const TIER_MODEL = process.env.TIER_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

/**
 * Off by default.
 *
 * The 503s that motivated this are a free-tier symptom, and silently moving a
 * call to a pricier model is the wrong surprise to hand someone on a paid key.
 * The mechanism stays because it costs nothing to keep: set
 * TIER_FALLBACK_MODEL=gemini-3.5-flash to use a bigger model when the cheap one
 * is unavailable. A `model.fallback` event and the bill both record when it
 * fires, and which model actually answered.
 */
export const TIER_FALLBACK_MODEL = process.env.TIER_FALLBACK_MODEL ?? '';

const TIER_INSTRUCTIONS = `You are a product specialist for Elgiganten, a Nordic electronics and appliance
retailer. You know how brands and product lines are positioned in the Nordic
market, across every kind of product this retailer sells.

You receive a category path and a numbered list of products from that
category. Assign each one a premium tier from 0 to 3.

The scale:

  0  entry      — the cheapest way to get this kind of product. Budget brands,
                  retailer house brands, nothing in the name that distinguishes
                  it from the next cheapest thing.
  1  mid        — mainstream. An established brand's standard line.
  2  premium    — an established brand's upper line, or a brand that competes
                  only at the upper end of this category. Named series, flagship
                  model designations, design-led lines.
  3  luxury     — the top of a serious brand's range, or a brand whose entire
                  positioning in this category is luxury. Statement products.

Rules:

- Judge WITHIN the given category. The question is never "is this expensive for
  a product", it is "where does this sit among products of this kind".
- You are NOT given prices, and you should not try to guess them. Judge market
  positioning from the brand, the product line, and what the name states.
- Size, capacity and quantity are not tier. A big basic product is still entry
  or mid; a small one from a premium line is still premium.
- Format and fitting are not tier either. How a product is installed, mounted,
  connected, packaged or worn tells you where it goes, not how good it is.
  Every format has cheap and expensive versions.
- Colour and finish are not tier on their own, but a named design-led line is a
  positioning signal.
- Use the full scale. If almost everything comes out as the same tier, you are
  not discriminating.
- When you genuinely cannot tell, answer tier 1 and confidence low. Do not
  guess high.

Answer once per item, using the item number you were given. confidence is
"high" only when the brand and line clearly place the product, and "low" when
you are inferring from a model code alone.`;

export const tierAnswerSchema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int().describe('The item number as given in the prompt'),
      tier: z.number().int().min(0).max(3),
      confidence: z.enum(['high', 'low']),
    }),
  ),
});

/**
 * Places products on a 0-3 premium scale inside one category.
 *
 * Nothing in these instructions names a kind of product: the same wording has
 * to work for a fridge, a phone, a game and a LEGO set. The only specific
 * thing is the category path, which goes in the message and which the model
 * reads directly.
 *
 * Price is deliberately withheld. A model shown the price sorts by price, and
 * the tier then adds nothing we did not already have for free. Judged from the
 * name alone it carries a second, independent signal — which is also what
 * makes it checkable: tier against price came out at Spearman 0.66 on fridges
 * and 0.75 on phones, agreeing with the market without copying it.
 *
 * The rule about format exists because of a measured mistake. An earlier
 * version listed built-in units as a premium marker, and the model dutifully
 * called a 4,744 kr built-in fridge premium. Format says where a product goes,
 * not how good it is.
 */
export const tierClassifier = new Agent({
  id: 'tier-classifier',
  name: 'tier-classifier',
  description: 'Assigns a 0-3 premium tier to products within a single category.',
  instructions: TIER_INSTRUCTIONS,
  model: google(TIER_MODEL),
});

/**
 * The brand list is an anchor, and it is there to fix a measured bug.
 *
 * Judging 98 fridges in one call and the same 98 in four calls of 25 produced
 * different tiers — the Samsung French Door came out premium in one and luxury
 * in the other. The cause is the instruction to use the full scale: inside a
 * slice, "full scale" means full scale *of that slice*, so a batch of mostly
 * mid-range products promotes its own top.
 *
 * Naming every brand in the category gives each batch the same competitive
 * landscape, so the scale stops depending on how the work was cut up.
 */
export const tierClassifierFallback = TIER_FALLBACK_MODEL
  ? new Agent({
      id: 'tier-classifier-fallback',
      name: 'tier-classifier-fallback',
      description: tierClassifier.getDescription(),
      instructions: TIER_INSTRUCTIONS,
      model: google(TIER_FALLBACK_MODEL),
    })
  : null;

export function tierPrompt(
  categoryPath: string,
  names: string[],
  brandsInCategory: string[] = [],
): string {
  const anchor = brandsInCategory.length
    ? `\nEvery brand sold in this category, so you can place these against the whole\nfield and not just against each other:\n\n  ${brandsInCategory.join(', ')}\n`
    : '';
  const list = names.map((n, i) => `${i + 1}) ${n}`).join('\n');
  return `Category: ${categoryPath}\n${anchor}\nProducts:\n\n${list}`;
}
