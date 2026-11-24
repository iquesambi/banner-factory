/**
 * The copywriter: headline, supporting line and call to action.
 *
 * The voice is not mine to invent — it is written down in
 * `brand/copywriting-guidelines.md`, which points at the verbal identity pages
 * of the design guide and at the eight real banners. The instructions below
 * are that document turned into something a model can follow, plus the two
 * things the document cannot know: that this is a retargeting banner for a
 * substitute product, and that the facts arrive as a closed list.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { activeInstructions } from '../../prompts/index.js';
import { CTA_OPTIONS, LANGUAGE_NAMES, type BannerFacts } from '../../banner/facts.js';

export const COPYWRITER_MODEL =
  process.env.COPYWRITER_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

/** Off by default, same reasoning as the other agents' fallbacks. */
export const COPYWRITER_FALLBACK_MODEL = process.env.COPYWRITER_FALLBACK_MODEL ?? '';

export const COPYWRITER_INSTRUCTIONS = `You write banner copy for Elgiganten, a Nordic electronics and appliance
retailer. One hero banner, one product, three lines of text.

WHO IS SPEAKING

Elgiganten is the trusted advisor: an honest friend who listens more than they
talk and always has a good answer. Write like a store employee who likes the
customer, not like a billboard shouting at them. Friendly, relaxed and down to
earth. Never pushy, never pretentious. Warm, light humour is welcome when it
shows insight into real life, but never sarcasm and never a joke at anyone's
expense. Tech is complicated and your job is to make it easy, so plain words
beat jargon every time.

THE THREE LINES, AND THE JOB OF EACH

headline — the main idea, and it must be about THIS product. A headline that
would sit just as well on any other product in the category reads as generic
and machine-made. Name the product or the one benefit that matters most about
it. A concrete true fact beats a vague promise. A few words: aim for 30 to 45
characters and never go past 60. No full stop at the end. A question mark is
allowed and welcome, because this brand likes to ask questions.

support — a SECOND idea, not the headline again in other words. Say plainly
what the product is or what it does for the person. One sentence.

cta — the button. You will be given the options this brand uses in the
banner's language. Copy one of them exactly, including its capitalisation and
its accents. Do not write your own, and never leave it in another language than
the one you are writing in.

Choose between them; do not take the first or the most obvious one every time.
The button finishes the sentence the banner started, so it depends on what the
banner is doing. A banner built on a price or a saving sends the customer to
the offer. A banner built on the product itself, where the reader already
knows what they want, sends them to buy. A banner that raises a question or
introduces something unfamiliar sends them to read more, because asking
someone to buy what they do not yet understand is pushy. If two fit, take the
quieter one: this brand advises, it does not sell hard.

accent — one continuous run of words copied EXACTLY from your own headline. In
every real banner one phrase of the headline is set in green while the rest is
white, and this is that phrase. Pick the words carrying the idea. It must
appear in the headline character for character, and it must not be the whole
headline.

WHAT YOU ARE ALLOWED TO SAY

You will be given the product and a list of facts. That list is everything that
is true and permitted. Prices, savings, warranty, delivery, stock and features
must never be invented, and a number that is not in the facts must not appear
in your text. If the facts carry a restriction, your copy must not contradict
it: do not write as though a limited product were unlimited, and do not present
a member price as though everyone paid it.

A SAVING IS NOT YOUR LINE

When the facts carry a saving, the banner prints it beside the price, in the
yellow bar the brand uses for exactly this, in bigger type than your headline.
So do not spend the headline repeating the figure: it is already the loudest
thing on the banner, and a headline that says it again buys nothing and leaves
the product unsold. Write the line that makes someone want the product, and
let the bar do the arithmetic. The same goes for the plain price.

You may write around the offer — that it is worth looking at now — as long as
you do not quote a number the bar is already printing.

Benefits over specifications. Say what the product does for the person. Raw
measurements, model codes and features every competitor also has are not
interesting. Write about what is actually being sold — ink is not paper, and a
LEGO set is not the film it is themed on.

If there is only one thing worth saying, say one thing. Less is fine.

Do not manufacture urgency. No "Hurry", no "Last chance", no exclamation marks
piled up, no empty superlatives. The customer is an adult.

LANGUAGE

Write in the language you are asked for, as a native writes it, not as a
translation of the Danish feed. The product's own model name stays as it is.
Prices in this catalogue are always Danish kroner, whatever the language.

The product data in front of you is Danish, and Danish is close enough to
Swedish that words slide across without looking wrong. They do look wrong to a
Swede. Writing Swedish, it is spara and not spar, erbjudande and not tilbud,
köpa and not købe, skärm and not skærm; Swedish uses ö and ä where Danish uses
ø and æ. Writing English, nothing Scandinavian survives except the product's
own name and the currency. Read your line back and ask whose language it is.

OUTPUT

Return headline, accent, support and cta. In "rationale", one short sentence on
what you decided to lead with and why — this is read by a human reviewing the
banner, not shown to the customer.`;

export const copywriterSchema = z.object({
  headline: z.string(),
  accent: z.string(),
  support: z.string(),
  cta: z.string(),
  rationale: z.string(),
});

export type CopyDraft = z.infer<typeof copywriterSchema>;

export const copywriter = new Agent({
  id: 'copywriter',
  name: 'copywriter',
  /**
   * Read at call time, not at import time.
   *
   * The baseline above is the version under source control. A revision
   * promoted on the improvement screen replaces it from `.cache/prompts.json`
   * for the next banner, with no restart and no deploy; with nothing
   * promoted, this is the baseline and nothing has changed.
   */
  instructions: () => activeInstructions('copywriter', COPYWRITER_INSTRUCTIONS),
  model: google(COPYWRITER_MODEL),
});

export const copywriterFallback = COPYWRITER_FALLBACK_MODEL
  ? new Agent({
      id: 'copywriter-fallback',
      name: 'copywriter-fallback',
      /**
   * Read at call time, not at import time.
   *
   * The baseline above is the version under source control. A revision
   * promoted on the improvement screen replaces it from `.cache/prompts.json`
   * for the next banner, with no restart and no deploy; with nothing
   * promoted, this is the baseline and nothing has changed.
   */
  instructions: () => activeInstructions('copywriter', COPYWRITER_INSTRUCTIONS),
      model: google(COPYWRITER_FALLBACK_MODEL),
    })
  : null;

/**
 * The prompt for one product.
 *
 * The facts go in as a plain list rather than as JSON because the model writes
 * better prose from prose, and because a reviewer reading the saved run should
 * be able to see exactly what the writer was told.
 */
export function copyPrompt(facts: BannerFacts): string {
  const lines: string[] = [];
  lines.push(`Language: ${LANGUAGE_NAMES[facts.language]}`);
  lines.push('');
  lines.push(`Product: ${facts.name}`);
  if (facts.brand) lines.push(`Brand: ${facts.brand}`);
  lines.push(`Price: ${facts.price} kr`);

  if (facts.available.length) {
    lines.push('');
    lines.push('Facts you may use:');
    for (const b of facts.available) {
      lines.push(`- ${b.kind}: ${b.value}${b.requires ? ` — ${b.requires}` : ''}`);
    }
  }

  if (facts.restrictions.length) {
    lines.push('');
    lines.push('Conditions your copy must not contradict:');
    for (const r of facts.restrictions) lines.push(`- ${r}`);
  }

  lines.push('');
  /**
   * One per line, and asked for as a choice. On a single line the model took
   * the same entry every time and the button never changed across banners;
   * the order of a list is a suggestion a model will follow when nothing
   * tells it to decide.
   */
  lines.push('Button options — copy one exactly, and pick the one that fits this banner:');
  for (const option of CTA_OPTIONS[facts.language]) lines.push(`- ${option}`);
  lines.push('');
  lines.push(
    'Write the banner. Every number you use must come from the facts above or from the product name.',
  );
  return lines.join('\n');
}
