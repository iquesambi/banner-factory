/**
 * The reviewer: is the new prompt actually better?
 *
 * It never sees a prompt. It sees two pieces of work — one made with the
 * instructions in force and one made with the candidate, on the SAME product
 * — and says which it would ship. Judging the output rather than the text of
 * the prompt is the only way to be wrong in a useful direction: a prompt can
 * read beautifully and produce worse banners, and that is exactly the failure
 * this loop would otherwise walk straight into.
 *
 * Two defences against the ways an A/B judge usually fails:
 *
 *   - Which side is which is hidden and the order is shuffled per case, so
 *     "prefers the second one" and "prefers the new one" cannot be confused.
 *     The caller knows the mapping; the model does not.
 *
 *   - A tie is a first-class answer. A judge with no "they are the same"
 *     option invents a preference, and a loop that promotes on invented
 *     preferences drifts for ever at full price.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const REVIEWER_MODEL = process.env.REVIEWER_MODEL ?? 'gemini-4-carbon';

const REVIEWER_INSTRUCTIONS = `You are reviewing two versions of the same piece of work for an Elgiganten
hero banner. Both were made from the same product and the same facts, by the
same kind of agent, under different instructions. You decide which one the
shop should use.

Elgiganten's voice is the trusted advisor: friendly, plain, honest, never
pushy and never shouting. A banner is one product, a short headline, a
supporting line and a button. The customer is an adult.

HOW TO CHOOSE

Judge the work, not the style you would have chosen. Ask which one does more
for the person looking at it: says something specific about THIS product,
reads like a person wrote it, and leaves the reader knowing what they would be
buying.

You are told what people complained about in earlier banners. A version that
fixes that complaint is better for fixing it — but only if it has not broken
something else to do it.

"Equal" is a real answer and you should use it when neither is clearly
better. Small differences of taste are equal. If you find yourself reaching
for a reason, the answer is equal.

BROKEN RULES

Separately from which is better, check whether either version breaks a rule
this shop cannot break:

  - a price, saving, percentage or any other number that was not in the facts
    you were given
  - a claim the facts do not support, or that contradicts a stated condition
  - the wrong language, or a word from the wrong Scandinavian language
  - a button that is not one of the options listed
  - manufactured urgency: hurry, last chance, piled-up exclamation marks

Report these in "broken", saying which version and which rule. A broken rule
is not a matter of degree and it is not outweighed by better writing.

OUTPUT

"better": "first", "second" or "equal".
"because": one sentence. Say what decided it.
"broken": one line per rule break, empty when there are none.`;

export const reviewSchema = z.object({
  better: z.enum(['first', 'second', 'equal']),
  because: z.string(),
  broken: z.array(z.string()),
});

export type ReviewAnswer = z.infer<typeof reviewSchema>;

export const reviewer = new Agent({
  id: 'reviewer',
  name: 'reviewer',
  instructions: REVIEWER_INSTRUCTIONS,
  model: google(REVIEWER_MODEL),
});

export function reviewPrompt(input: {
  /** What the two versions are: copy, badge choice, layout. */
  what: string;
  product: string;
  facts: string[];
  buttons: string[];
  complaints: string[];
  first: string;
  second: string;
}): string {
  const lines: string[] = [];
  lines.push(`What you are comparing: ${input.what}`);
  lines.push(`Product: ${input.product}`);
  lines.push('');
  lines.push('The facts both versions were allowed to use:');
  for (const f of input.facts) lines.push(`- ${f}`);
  if (!input.facts.length) lines.push('- none beyond the product and its price');
  if (input.buttons.length) {
    lines.push('');
    lines.push(`The only permitted buttons: ${input.buttons.join(' | ')}`);
  }

  if (input.complaints.length) {
    lines.push('');
    lines.push('What people complained about in earlier banners:');
    for (const c of input.complaints.slice(0, 6)) lines.push(`- ${c}`);
  }

  lines.push('');
  lines.push('=== FIRST ===');
  lines.push(input.first);
  lines.push('');
  lines.push('=== SECOND ===');
  lines.push(input.second);
  lines.push('');
  lines.push('Which should the shop use?');
  return lines.join('\n');
}
