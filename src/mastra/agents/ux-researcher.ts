/**
 * The UX researcher: what to try when a banner is not working.
 *
 * It is called only after the measurement says something is wrong, and its
 * job is narrow on purpose: ONE change, to ONE dimension, with a hypothesis
 * that the test can actually come back and contradict. A variant that moves
 * the layout and rewrites the headline and swaps the button teaches nothing
 * when it wins, because nobody can say which part won.
 *
 * It does not write banner copy. When it wants the words changed it writes a
 * direction for the copywriter, which keeps the new text inside every check
 * that makes copy safe — the facts it may use, the closed list of buttons,
 * the language rules. A researcher that handed us finished text would be a
 * second, unchecked copywriter.
 *
 * It is also told what has already been tried on this product and how those
 * tests ended, because proposing the losing idea again is the most expensive
 * mistake available here: it costs the traffic of a whole test to rediscover
 * something already written down.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { LAYOUTS } from '../../banner/brief.js';
import { CTA_OPTIONS, LANGUAGE_NAMES, type Language } from '../../banner/facts.js';

/** The same larger model the improver uses: this is a judgement, made rarely. */
export const RESEARCHER_MODEL = process.env.RESEARCHER_MODEL ?? 'gemini-4-carbon';

const RESEARCHER_INSTRUCTIONS = `You are a UX researcher working on retail hero banners. A banner is
underperforming against the other banners in the shop, and you decide what to
try instead.

You are given the banner — the product, the words on it, the facts beside the
price, how it is laid out — what it was measured at, and what has already
been tried on this product.

WHAT YOU DECIDE

One change, to exactly one of three things:

  layout — the arrangement. Where the product sits, where the text sits, how
  large the type is. Use this when the banner's problem is that nothing
  catches the eye, or that the thing worth seeing is in the wrong place.

  cta — the button. Use this when the banner reads well but the next step is
  wrong for what it is saying: asking someone to buy something they have just
  been introduced to, or sending someone who already knows what they want off
  to read more.

  copy — the words. You do NOT write them. You write a direction for the
  copywriter: what the headline should be about and why. Use this when the
  banner is saying the wrong thing about the product, or saying nothing
  specific about it at all.

ONE AT A TIME

Two changes in one variant cannot be told apart by the result. If you think
both the layout and the words are wrong, pick the one you believe is doing
more damage and say in your hypothesis what you would try next if this does
not move anything.

THE HYPOTHESIS

Say what you expect to happen and why, in a way the measurement can
contradict. "This will perform better" is not a hypothesis. "The headline
names the category rather than the product, so people cannot tell what is
being offered; naming the product should raise the click rate" is one,
because if the rate does not move you have learned the headline was not the
problem.

Be honest about weak evidence. If the banner's numbers are thin or the
difference from the others is small, say so in your hypothesis rather than
inventing a confident story.

WHAT YOU DO NOT TOUCH

The price, the saving, the energy label and everything else on the right of
the banner are facts from the shop's feed. They are not design decisions and
they are not yours to change, add or hide. If you believe the problem is that
the banner shows the wrong facts, say that in your note — that is a change to
the strategist's instructions, not a variant.

Never propose anything that would make the banner less true: no urgency that
is not real, no discount that is not in the facts, no claim the feed does not
support.

OUTPUT

"dimension": layout, cta or copy.
"layout": when the dimension is layout, the arrangement to use instead, from
the list you are given.
"cta": when the dimension is cta, the button text, copied exactly from the
permitted list.
"copyDirection": when the dimension is copy, one or two sentences telling the
copywriter what to do differently.
"hypothesis": what you expect and why, as above.
"note": anything a person reading this should know, including what you would
try next. One short paragraph.`;

export const researchSchema = z.object({
  dimension: z.enum(['layout', 'cta', 'copy']),
  layout: z.enum(['classic', 'mirrored', 'wide']).nullable(),
  cta: z.string().nullable(),
  copyDirection: z.string().nullable(),
  hypothesis: z.string(),
  note: z.string(),
});

export type ResearchAnswer = z.infer<typeof researchSchema>;

export const uxResearcher = new Agent({
  id: 'ux-researcher',
  name: 'ux-researcher',
  instructions: RESEARCHER_INSTRUCTIONS,
  model: google(RESEARCHER_MODEL),
});

export interface PastTest {
  dimension: string;
  what: string;
  hypothesis: string;
  outcome: string;
}

export function researchPrompt(input: {
  product: string;
  language: Language;
  headline: string;
  accent: string;
  support: string;
  cta: string;
  badges: string[];
  layout: string;
  measurement: string;
  verdicts: string[];
  past: PastTest[];
}): string {
  const lines: string[] = [];
  lines.push(`Product: ${input.product}`);
  lines.push(`Language: ${LANGUAGE_NAMES[input.language]}`);
  lines.push('');
  lines.push('The banner as it stands:');
  lines.push(`  headline: ${input.headline}`);
  lines.push(`  the words set in green: ${input.accent}`);
  lines.push(`  supporting line: ${input.support}`);
  lines.push(`  button: ${input.cta}`);
  lines.push(`  facts beside the price: ${input.badges.join(', ') || 'none'}`);
  lines.push(`  arrangement: ${input.layout} — ${LAYOUTS[input.layout as keyof typeof LAYOUTS]?.note ?? ''}`);
  lines.push('');
  lines.push('How it is doing:');
  lines.push(`  ${input.measurement}`);

  if (input.verdicts.length) {
    lines.push('');
    /**
     * Thumbs, not comments. There is no field anywhere in this system for a
     * person to write why they disliked something, so this list is three
     * possible facts and no reasons. Saying so in the prompt is the whole
     * point of the line: a model handed "the words were rejected" under a
     * heading that promises an opinion will supply the missing opinion
     * itself, and that invented reason would then steer the variant.
     */
    lines.push('Judgements left inside the shop — approve or reject, one per part of');
    lines.push('the banner. Nobody wrote a reason, because there is nowhere to write one.');
    lines.push('Treat these as signals of WHERE somebody was unhappy, never as evidence of why:');
    for (const v of input.verdicts) lines.push(`  - ${v}`);
  }

  lines.push('');
  lines.push('The arrangements you may choose from:');
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    lines.push(`  - ${name}: ${layout.note}`);
  }
  lines.push('');
  lines.push(`The only permitted buttons: ${CTA_OPTIONS[input.language].join(' | ')}`);

  if (input.past.length) {
    lines.push('');
    lines.push('Already tried on this product:');
    for (const p of input.past) {
      lines.push(`  - ${p.dimension}: ${p.what} — expected: ${p.hypothesis} — result: ${p.outcome}`);
    }
    lines.push('Do not propose any of these again unless you can say what is different now.');
  }

  lines.push('');
  lines.push('What should we try?');
  return lines.join('\n');
}
