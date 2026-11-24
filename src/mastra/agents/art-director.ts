/**
 * The art director: the layout judgements, and only those.
 *
 * It does not write the banner's HTML, and it never sees a colour or a pixel
 * value. The grid, the palette, the type and the price block are measured
 * brand facts that live in the renderer, and asking a model to reproduce them
 * would only introduce a way for them to come out wrong.
 *
 * What is left is genuinely a judgement, and it is the thing every reference
 * banner shows someone deciding: where the headline breaks, and how big the
 * product should sit. "DET ER PERFEKT AT / OPGRADERE LIGE NU" is a choice —
 * the same words broken after "PERFEKT" would read worse, and no rule I can
 * write picks correctly for an arbitrary sentence in three languages.
 *
 * Everything it returns is a closed set or is checked against the copy, so a
 * wrong answer is visible rather than silently rendered.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { activeInstructions } from '../../prompts/index.js';
import type { ArtDirectorBrief } from '../../banner/brief.js';

export const ART_DIRECTOR_MODEL =
  process.env.ART_DIRECTOR_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

export const ART_DIRECTOR_FALLBACK_MODEL = process.env.ART_DIRECTOR_FALLBACK_MODEL ?? '';

export const ART_DIRECTOR_INSTRUCTIONS = `You are the art director for an Elgiganten hero banner, 2048 by 768. The
product is chosen, the copy is written and the badges are decided. The grid,
the colours and the type are fixed brand assets and are not yours to change.
Two things are yours.

HOW THE HEADLINE BREAKS

The headline is set large, in upper case, in a column down the left of the
banner. You decide how it breaks across lines: one, two or at most three.

Break where the sense breaks. A line should end where a speaker would pause,
and the phrase carrying the idea should land together on one line rather than
be split across two. Never strand a single short word on a line of its own,
and never separate a number from the thing it counts.

The lines are set left-aligned, so a long line followed by a much shorter one
looks unbalanced. Aim for lines of a similar length, with the longer one first
when they cannot match.

One more constraint, and it is hard: the phrase marked as the accent is set in
a different colour, and it has to sit inside ONE line. If keeping it whole
forces an awkward break, say so in your rationale and keep the accent whole
anyway.

Return the lines as they should appear. Together they must be exactly the
headline you were given, word for word, with nothing added, nothing dropped
and nothing reworded. You are breaking a line, not rewriting a sentence.

HOW BIG THE PRODUCT SITS

The product photograph is cut out and placed on the navy in the middle of the
banner. The whole product is always visible — it is never cropped by the edge
of the canvas, and there is always air above and below it. You are choosing
how much of that room it takes:

  fill    it should dominate — a large television, a fridge, a tall appliance
  large   the normal choice for a laptop, a console, a kitchen machine
  medium  a phone, a camera, a pair of headphones
  small   something genuinely small, where blowing it up shows only texture

Think about how the object is met in life. Something a person stands in front
of can be commanding. Something held in the hand looks absurd at two metres
tall, and shrinking a small object does not make it look small — it makes the
banner look empty. When in doubt choose large.

OUTPUT

headlineLines, productScale, and one short sentence in rationale saying why
you broke the headline where you did.`;

export const artDirectionSchema = z.object({
  headlineLines: z.array(z.string()).min(1).max(3),
  productScale: z.enum(['fill', 'large', 'medium', 'small']),
  rationale: z.string(),
});

export type ArtDirection = z.infer<typeof artDirectionSchema>;

export const artDirector = new Agent({
  id: 'art-director',
  name: 'art-director',
  /**
   * Read at call time, not at import time.
   *
   * The baseline above is the version under source control. A revision
   * promoted on the improvement screen replaces it from `.cache/prompts.json`
   * for the next banner, with no restart and no deploy; with nothing
   * promoted, this is the baseline and nothing has changed.
   */
  instructions: () => activeInstructions('art-director', ART_DIRECTOR_INSTRUCTIONS),
  model: google(ART_DIRECTOR_MODEL),
});

export const artDirectorFallback = ART_DIRECTOR_FALLBACK_MODEL
  ? new Agent({
      id: 'art-director-fallback',
      name: 'art-director-fallback',
      /**
   * Read at call time, not at import time.
   *
   * The baseline above is the version under source control. A revision
   * promoted on the improvement screen replaces it from `.cache/prompts.json`
   * for the next banner, with no restart and no deploy; with nothing
   * promoted, this is the baseline and nothing has changed.
   */
  instructions: () => activeInstructions('art-director', ART_DIRECTOR_INSTRUCTIONS),
      model: google(ART_DIRECTOR_FALLBACK_MODEL),
    })
  : null;

export function artDirectionPrompt(brief: ArtDirectorBrief): string {
  const lines: string[] = [];
  lines.push(`Product: ${brief.product.name}`);
  if (brief.product.brand) lines.push(`Brand: ${brief.product.brand}`);
  lines.push(`Price: ${brief.product.priceText}`);
  lines.push('');
  lines.push(`Headline: ${brief.copy.headline}`);
  lines.push(`Accent phrase, which must stay inside one line: ${brief.copy.accent}`);
  lines.push(`Supporting line: ${brief.copy.support}`);
  lines.push('');
  lines.push(
    brief.badges.length
      ? `Badges going in the side band: ${brief.badges.map((b) => `${b.kind} (${b.value})`).join(', ')}`
      : 'No badges in the side band.',
  );
  lines.push('');
  lines.push('Break the headline and size the product.');
  return lines.join('\n');
}

/**
 * Whether the lines are the headline and nothing else.
 *
 * Compares on words rather than on the raw string, so a changed space or a
 * line break does not fail, while a dropped, added or reworded word does.
 */
export function headlineMismatch(lines: string[], headline: string): string | null {
  // Case is ignored: the banner sets the headline in upper case anyway, so a
  // model that returns it shouted has not changed the words. Caught in
  // testing, where that alone was rejecting otherwise good layouts.
  const words = (s: string) => s.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const got = lines.flatMap(words);
  const want = words(headline);
  if (got.join(' ') === want.join(' ')) return null;
  return `the lines read "${got.join(' ')}" but the headline is "${want.join(' ')}"`;
}
