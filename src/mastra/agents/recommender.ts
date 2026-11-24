import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { TaggedProduct } from '../../types.js';

export const RECOMMENDER_MODEL =
  process.env.RECOMMENDER_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

/** Off by default, same reasoning as TIER_FALLBACK_MODEL. */
export const RECOMMENDER_FALLBACK_MODEL = process.env.RECOMMENDER_FALLBACK_MODEL ?? '';

const RECOMMENDER_INSTRUCTIONS = `You are an experienced salesperson at Elgiganten, a Nordic electronics and
appliance retailer. You know this catalogue and you know how to read what
someone wants from what they were looking at.

Think like someone on the shop floor. The customer chose that specific product
and not just anything in the category, and the name is where the reason lives:
the brand, the product line or series, the exact variant, and whatever else the
name spells out. A good substitute honours the reasons that are visible in the
name.

A lower price is not a compromise. If a candidate offers what the customer was
looking at and costs less, that is a better recommendation, not a worse one.
Never rank a product down for being cheaper, and never rank one up for costing
about the same as what the customer wanted.

An accessory FOR a product is never a substitute FOR that product. Someone who
wanted the thing itself is not served by a case, a cable, a mount, a camera, a
spare part or a cover for it, however well it matches. Leave those out.

The product the customer wanted may be a composite: a base product packaged
with something extra — a bundle, a pack, a set, an edition that includes
content. When it is, two kinds of substitute are strong and you should offer
them. The same base product packaged with a different extra, and the base
product on its own without any extra. Both give the customer the thing they
actually came for. Say which of the two you are offering and name what they
give up, and remember that the base product alone normally costs less, which
is a point in its favour and not against it.

Spelling and word forms vary across this catalogue, especially in compounds, so
two names can describe the same product while being written differently. Judge
what the product is, not whether the characters match.

Work only from what the names and the prices actually say. Do not assume
anything that is not written there.

Rank the candidates you would actually put in front of this customer, best
first. Leave out the ones you would not offer at all.

For each one, give ONE short sentence saying why, naming the specific thing it
shares with the product the customer wanted, or the specific trade-off you are
offering. "Similar price" is not a reason. If the real reason is a compromise,
say so plainly: a salesperson who oversells loses the sale.

An empty list is how you say no, and it is for ONE situation: when none of the
candidates is the same kind of product the customer was looking at. A list of
accessories when someone wanted the device, a list of games when someone wanted
the console — then saying no is the honest answer.

It is NOT for when you cannot verify every detail. These names are short and
routinely leave out size, capacity, finish and features, so you will often be
unable to confirm an exact match. That is a gap in the data, not a reason to
send the customer away. Someone who looked at one wine cabinet is still served
by another wine cabinet; someone who looked at one laser printer is still
served by another laser printer. When the candidates are the same kind of
product, offer the best of them and use the reason to say what you could not
confirm.

Answer with the item NUMBER from the candidate list, never a name or a code.`;

export const pickSchema = z.object({
  picks: z.array(
    z.object({
      item: z.number().int().min(1).describe('The product number from the candidate list'),
      reason: z.string().describe('One short sentence naming what it shares, or the trade-off'),
    }),
  ),
  noneReason: z.string().nullable(),
});

export type Picks = z.infer<typeof pickSchema>;

/**
 * Chooses which in-stock product to show instead of one the customer wanted.
 *
 * Two things in here were learned the hard way.
 *
 * The answer is an INDEX, never a sku or a name, so the model cannot name a
 * product that is not on the list and an out-of-range number is a detectable
 * error rather than a plausible lie. The brief requires everything on the
 * banner to be true and from the feed; this is how that is enforced rather
 * than hoped for.
 *
 * An empty `picks` array IS the refusal. The first version asked the model to
 * "say so instead of ranking" and it answered in prose, which a workflow then
 * has to interpret. `picks.length === 0` needs no interpretation, and
 * `noneReason` carries the explanation to the log without ever steering a
 * decision.
 *
 * The instruction that a lower price is not a compromise is deliberate: an
 * equivalent product that costs less is a better recommendation, and ranking
 * by closeness to the seed's price would bury exactly the options worth
 * showing.
 */
export const recommender = new Agent({
  id: 'recommender',
  name: 'recommender',
  description: 'Ranks in-stock substitutes for a product the customer wanted, with reasons.',
  instructions: RECOMMENDER_INSTRUCTIONS,
  model: google(RECOMMENDER_MODEL),
});

export const recommenderFallback = RECOMMENDER_FALLBACK_MODEL
  ? new Agent({
      id: 'recommender-fallback',
      name: 'recommender-fallback',
      description: recommender.getDescription(),
      instructions: RECOMMENDER_INSTRUCTIONS,
      model: google(RECOMMENDER_FALLBACK_MODEL),
    })
  : null;

export interface RecommendPromptInput {
  categoryPath: string;
  seed: TaggedProduct;
  candidates: TaggedProduct[];
  /** True on the widened second pass, where candidates span neighbouring tiers. */
  widened: boolean;
  seedTier: number;
  /**
   * 'substitute' replaces a product that is out of stock; 'suggest' offers
   * something alongside one that is in stock. The two are different sales
   * conversations and the prompt has to say which one this is.
   */
  mode?: 'substitute' | 'suggest';
  /** Who the customer probably is, when a cluster was decided. */
  cluster?: { label: string; note: string } | null;
  /** The picker's reading of this customer, and the sections it chose. */
  profile?: string | null;
  sections?: string[];
}

export function recommendPrompt(input: RecommendPromptInput): string {
  const { categoryPath, seed, candidates, widened, seedTier } = input;
  const suggest = input.mode === 'suggest';

  const framing = widened
    ? `Below are products we DO have in stock, from the same category. Each carries a
premium tier from 0 (entry) to 3 (luxury), judged separately from its price.
The product the customer wanted is tier ${seedTier}.

Nothing at exactly that tier was a reasonable substitute, so this list also
includes the tier above and below. A product that matches what the customer was
actually looking at can be the better recommendation even at a different tier.
Weigh tier as one signal among what the names tell you, not as a rule.`
    : `Below are products we DO have in stock, from the same category. All of them sit
at the same premium tier as the product the customer wanted, judged separately
from price.`;

  // No discount and no previous price: what to do with a promotion is a
  // business rule, applied after the model has chosen on merit.
  const list = candidates
    .map(
      (p, i) =>
        `${String(i + 1).padStart(2)}  ${p.name}  —  ${p.price} kr${
          widened && p.tier !== null && p.tier !== undefined ? `  —  tier ${p.tier}` : ''
        }`,
    )
    .join('\n');

  /**
   * The seed being in stock turns the standing instructions on their head in
   * one specific way: there, an empty list is the honest answer when nothing
   * is the same KIND of product. Here a different kind is often the whole
   * point — a soundbar beside a television. Said explicitly rather than hoped
   * for, because the instructions are written for substitution.
   */
  const situation = suggest
    ? `A customer was looking at this product, and we DO have it in stock:

  ${seed.name}
  ${seed.price} kr

Nothing needs replacing, so this is not a substitution. The banner is an offer:
what else would you put in front of this customer, knowing they were looking at
that.

Three things about this list are different from a substitution, and they
override the standing instructions where they disagree.

A product of a DIFFERENT KIND is allowed and is often the better
recommendation. The candidates below were drawn from sections of the shop
chosen for this customer, so the list deliberately mixes what they were
looking at with what goes alongside it — a monitor and a mouse beside a
laptop, a freezer beside a fridge.

Things that go WITH the product now count. The standing rule that an accessory
is never a substitute holds for replacing a product, not for this: someone
buying a laptop is well served by a bag or a second screen. A spare part for
one specific model is still not a recommendation.

The brand is a signal of taste, not a target to match. A list of three products
from the same brand as the seed is a weak list — the customer has already found
that brand. Prefer a ranking that gives them more than one kind of answer.

Refuse only if nothing on the list makes sense for this customer at all.`
    : `A customer was looking at this product, but it is out of stock:

  ${seed.name}
  ${seed.price} kr`;

  const who = [
    input.profile ? `Who this customer probably is: ${input.profile}` : null,
    input.cluster ? `How they tend to buy: ${input.cluster.label}. ${input.cluster.note}` : null,
    input.sections?.length
      ? `Sections these candidates were drawn from, in order: ${input.sections.join(', ')}`
      : null,
  ].filter(Boolean).join('\n');

  const ask = suggest
    ? 'Recommend what else to show this customer, ranked best first.'
    : 'Recommend what to show this customer instead, ranked best first.';

  return `Category: ${categoryPath}

${situation}

${who}

${framing}

${ask}

Candidates:

${list}`;
}
