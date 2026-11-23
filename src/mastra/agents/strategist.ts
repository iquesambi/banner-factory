/**
 * The strategy director: which extras earn their place on the banner.
 *
 * It runs after the copywriter and sees the copy, which is the whole point.
 * The brand guide asks that each line carry its own idea and that lines not
 * repeat each other; a savings badge next to a headline that already says
 * "save 2,300" breaks that rule just as surely as two identical lines would.
 * Only something that has read the copy can catch it.
 *
 * It chooses by INDEX from the permitted list, never by name. A badge this
 * catalogue does not support cannot be expressed as a number in range, and an
 * index out of range is detectable; an invented badge name would not be.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { BADGE_LABELS, LANGUAGE_NAMES, type BannerFacts } from '../../banner/facts.js';
import type { CopyDraft } from './copywriter.js';

export const STRATEGIST_MODEL =
  process.env.STRATEGIST_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

export const STRATEGIST_FALLBACK_MODEL = process.env.STRATEGIST_FALLBACK_MODEL ?? '';

const STRATEGIST_INSTRUCTIONS = `You are the strategy director for an Elgiganten hero banner. The product is
chosen, the copy is written, and the facts that may be shown have already been
checked for truth. Your job is to decide which of those facts earn a place on
the banner, and in what order.

Everything on the list is true and permitted. The question is never "is this
allowed" — it is "does this make the banner work harder".

WHAT MAKES A BADGE EARN ITS PLACE

It adds something the copy does not already say. The headline and the
supporting line are in front of you. If the copy already carries the saving,
the badge repeating it buys nothing and costs the one slot that could have
carried a second idea.

It matters for THIS product. Energy running costs weigh on a fridge or a
washing machine over ten years, and weigh very little on a pair of headphones.
A multi-buy mechanic matters on something people buy in quantity and not on a
television. Judge the product in front of you, not the category in the
abstract.

It is worth a customer's attention. A badge is a promise that the thing it
points at is worth stopping for.

HOW MANY

The right side of the banner holds the price and very little else. Two badges
is a comfortable banner, three is full, and more than three is clutter that
makes every one of them weaker. Showing none is a legitimate answer when the
product sells on what it is.

Order matters: put first the one you would want seen if the customer looks at
the banner for half a second.

ABOUT THE ENERGY LABEL

Treat this one differently from the others. In the reference banners the energy
label appears whenever the product has a class at all, including one banner
that shows a G. That pattern suggests it is carried because the product has it
and not because it sells, so a poor class is not a reason to drop it. Judge
whether to lead with it, not whether to carry it.

ABOUT CONDITIONS

Some facts come with a condition attached — a price that only members pay, a
warranty with terms. If you show one of those, the condition has to appear on
the banner. Put it in "finePrint", written in the banner's language, in the one
line of small text that runs along the bottom. If nothing you chose needs a
condition, leave it null.

OUTPUT

In "show", list the facts you are putting on the banner, by their number, best
first, each with one short sentence saying what it adds. In "skip", list the
ones you are leaving off, by their number, each with one short sentence saying
why. Every number must come from the list you were given. A fact belongs in
one list or the other, never both.`;

export const strategySchema = z.object({
  show: z.array(z.object({ item: z.number().int().min(1), reason: z.string() })),
  skip: z.array(z.object({ item: z.number().int().min(1), reason: z.string() })),
  finePrint: z.string().nullable(),
});

export type StrategyAnswer = z.infer<typeof strategySchema>;

export const strategist = new Agent({
  id: 'strategist',
  name: 'strategist',
  instructions: STRATEGIST_INSTRUCTIONS,
  model: google(STRATEGIST_MODEL),
});

export const strategistFallback = STRATEGIST_FALLBACK_MODEL
  ? new Agent({
      id: 'strategist-fallback',
      name: 'strategist-fallback',
      instructions: STRATEGIST_INSTRUCTIONS,
      model: google(STRATEGIST_FALLBACK_MODEL),
    })
  : null;

export function strategyPrompt(facts: BannerFacts, copy: CopyDraft): string {
  const lines: string[] = [];
  lines.push(`Language: ${LANGUAGE_NAMES[facts.language]}`);
  lines.push(`Product: ${facts.name}`);
  lines.push(`Price: ${facts.price} kr`);
  lines.push('');
  lines.push('The copy that is already written:');
  lines.push(`  headline: ${copy.headline}`);
  lines.push(`  support:  ${copy.support}`);
  lines.push(`  button:   ${copy.cta}`);
  lines.push('');
  lines.push('Facts available for the banner:');
  facts.available.forEach((b, i) => {
    lines.push(
      `${i + 1}. ${BADGE_LABELS[b.kind]} — ${b.value}${b.requires ? ` (${b.requires})` : ''}`,
    );
  });

  if (facts.restrictions.length) {
    lines.push('');
    lines.push('Conditions on this product:');
    for (const r of facts.restrictions) lines.push(`- ${r}`);
  }

  lines.push('');
  lines.push('Decide what goes on the banner.');
  return lines.join('\n');
}
