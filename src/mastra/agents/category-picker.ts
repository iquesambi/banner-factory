/**
 * Which parts of the shop to draw a suggestion from.
 *
 * This replaces a set of quotas I had written by hand. Those quotas said: most
 * of the list is the same category, some is the same kind, a fixed slice is
 * the rest of the department. That is a guess about every customer at once,
 * and it produced lists of three products from one brand, because the shape
 * was fixed and only the brand varied inside it.
 *
 * The shop floor answer is different. Someone looking at a Chromebook is
 * served by other laptops, but also by a monitor, a mouse, a printer, a bag —
 * and which of those depends on who they are. So the choice of WHERE to look
 * becomes a judgement, made once, against the real taxonomy.
 *
 * The answer is an INDEX into a list of categories that exist and have stock,
 * so the model cannot invent a section of the shop. Same enforcement as every
 * other closed-set answer in this project: an out-of-range index is a
 * detectable error, not a plausible lie.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { TaggedProduct } from '../../types.js';

export const CATEGORY_PICKER_MODEL =
  process.env.CATEGORY_PICKER_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

export const CATEGORY_PICKER_FALLBACK_MODEL = process.env.CATEGORY_PICKER_FALLBACK_MODEL ?? '';

/** How many sections of the shop one suggestion may draw from. */
export const MAX_PICKED_CATEGORIES = 6;

const INSTRUCTIONS = `You are an experienced salesperson at Elgiganten, a Nordic electronics and
appliance retailer. Someone is looking at a product that is in stock, so
nothing needs replacing. Your job is to decide WHERE IN THE SHOP to look for
what to show them next.

You do not pick products. You pick the sections of the shop a colleague should
then walk to.

HOW TO READ THE CUSTOMER

Start from the product. What someone chose to look at says what they are doing:
setting up a desk, furnishing a first flat, upgrading a rig, replacing
something that broke, buying a gift. The brand and the model line say how much
they care about the object itself.

Then say, in one sentence, who you think this person is and what they are
likely doing. Be concrete and work only from what you can see. Do not invent an
occupation, a household or a budget that the product does not support.

HOW TO PICK SECTIONS

Pick between three and six. Rank them, best first.

The section the product itself is in is usually worth picking, but it is never
the only answer, and picking only it is a failure. A customer who is already
looking at one of those has seen them.

The strongest list spans different KINDS of thing: what goes WITH the product,
what the product needs to be used, what the same person tends to buy in the
same trip. A laptop goes with a monitor, a mouse, a bag, a printer. A fridge
goes with a freezer, a dishwasher, kitchen storage.

Avoid sections that only make sense for a different customer than the one you
just described. A section with little stock is still fine to pick if it is
right; the counts are there so you can tell a real section from an empty one.

Do not pick a section because it is expensive, and do not pick one because it
is cheap. Price is not your decision here.

Answer with the section NUMBER from the list, never a name or a path. For each
one, give one short sentence saying what that section gives THIS customer.`;

export const categoryPickSchema = z.object({
  profile: z.string().describe('One sentence: who this customer is and what they are doing'),
  picks: z
    .array(
      z.object({
        item: z.number().int().min(1).describe('The section number from the list'),
        reason: z.string().describe('One short sentence: what this section gives this customer'),
      }),
    )
    .describe('Three to six sections, best first'),
});

export type CategoryPicks = z.infer<typeof categoryPickSchema>;

export const categoryPicker = new Agent({
  id: 'category-picker',
  name: 'category-picker',
  description: 'Chooses which sections of the catalogue a suggestion should be drawn from.',
  instructions: INSTRUCTIONS,
  model: google(CATEGORY_PICKER_MODEL),
});

export const categoryPickerFallback = CATEGORY_PICKER_FALLBACK_MODEL
  ? new Agent({
      id: 'category-picker-fallback',
      name: 'category-picker-fallback',
      description: categoryPicker.getDescription(),
      instructions: INSTRUCTIONS,
      model: google(CATEGORY_PICKER_FALLBACK_MODEL),
    })
  : null;

export interface CategoryOption {
  /** A node in the taxonomy, e.g. `computer-kontor/computertilbehor`. */
  path: string;
  /** In-stock products under it, so an empty section is visibly empty. */
  count: number;
}

export interface CategoryPickerPromptInput {
  seed: TaggedProduct;
  options: CategoryOption[];
  /** Which option index the seed itself sits in, 1-based, when it is on the list. */
  seedOption: number | null;
  /** The four-way reading, when one was decided. */
  cluster: { label: string; note: string } | null;
}

export function categoryPickerPrompt(input: CategoryPickerPromptInput): string {
  const { seed, options, seedOption, cluster } = input;

  const who = cluster
    ? `\nWhat we already think about this customer: ${cluster.label}. ${cluster.note}\n`
    : '';

  const list = options
    .map(
      (o, i) =>
        `${String(i + 1).padStart(2)}  ${o.path.padEnd(42)} ${String(o.count).padStart(5)} in stock` +
        (seedOption === i + 1 ? '   <- the product is in this one' : ''),
    )
    .join('\n');

  return `A customer is looking at this product, and we have it in stock:

  ${seed.name}
  ${seed.price} kr
  Section: ${seed.category}
${who}
These are the sections of the shop, with how many products each has in stock
right now:

${list}

Say who this customer is, then pick the sections to draw a suggestion from,
best first.`;
}
