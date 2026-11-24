/**
 * Filling in the categories the rules could not settle on their own.
 *
 * Measured on this catalogue, the deterministic matcher splits the shop into
 * three groups, and each deserves a different question:
 *
 *   12,873  a whole word matched and nothing tied with it. Accepted as is,
 *           free. The name literally says what the thing is.
 *    3,910  something matched, but only by splitting a glued Danish word, or
 *           it tied with another category. Worth ONE yes-or-no.
 *   11,448  nothing matched at all. Asking yes-or-no is pointless; the only
 *           useful question is open.
 *
 * All three answers are INDEXED or boolean, never a written category path,
 * except the open question — which is deliberately NOT a category. The model
 * is asked what the product IS, in a couple of Danish words, and that phrase
 * is then run back through the same deterministic matcher. The model supplies
 * language; the taxonomy stays the only thing that can name a category.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const ENRICHER_MODEL =
  process.env.ENRICHER_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

export const ENRICHER_FALLBACK_MODEL = process.env.ENRICHER_FALLBACK_MODEL ?? '';

/**
 * Products per request. Large, for the same reason the tier classifier
 * batches: the instructions are sent once instead of once per product, and at
 * this size the whole catalogue is a few hundred calls rather than 15,000.
 */
export const ENRICH_BATCH = Number(process.env.ENRICH_BATCH ?? 60);

const SHARED = `You classify products from a Danish electronics and appliance retailer
(Elgiganten). The names are Danish, often with English words mixed in.

Judge what the product IS, never what it is compatible with or themed on. A
phone case is an accessory, not a phone. A LEGO set of a video game is a toy,
not a game. Printer ink is ink, not paper. A bracket for a television is a
bracket.

Danish compounds are head-final: the last part carries the type.
"netvaerksswitch" is a switch, "toerretumbler" is a tumble dryer,
"opladningskabel" is a cable. But the head is a word, not just any ending:
"trommeenhed" is a drum unit for a printer, not a unit of something.`;

// ------------------------------------------------------------ 1. confirm
const CONFIRM_INSTRUCTIONS = `${SHARED}

For each numbered line you get a product name and the category a rule proposed
for it. The rule reached that answer by splitting a glued word or by breaking a
tie, so it is a guess worth checking.

Say whether the product belongs in that category.

Answer "yes" when the category describes what the product is, even if it is not
the most specific category imaginable. You are checking for a wrong answer, not
for a perfect one.

Answer "no" when the product is a different kind of thing. A charging cable
filed under HDMI cables is a no. A radio filed under radios is a yes.

Answer for every line, using its number.`;

export const confirmSchema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int().min(1).describe('The line number'),
      belongs: z.boolean(),
    }),
  ),
});

export const categoryConfirmer = new Agent({
  id: 'category-confirmer',
  name: 'category-confirmer',
  description: 'Says whether a proposed category describes what a product actually is.',
  instructions: CONFIRM_INSTRUCTIONS,
  model: google(ENRICHER_MODEL),
});

export interface ConfirmItem {
  name: string;
  proposed: string;
}

export function confirmPrompt(items: ConfirmItem[]): string {
  const list = items
    .map((it, i) => `${String(i + 1).padStart(3)}  ${it.name}\n     proposed: ${it.proposed}`)
    .join('\n');
  return `Does each product belong in the category proposed for it?\n\n${list}`;
}

// ------------------------------------------------------------- 2. choose
const CHOOSE_INSTRUCTIONS = `${SHARED}

Each numbered block is a product whose proposed category was rejected, followed
by the other categories the rules considered, lettered a, b, c and so on.

Pick the letter of the one that describes what the product is.

If none of them describes it, answer with the letter "x". That is a real
answer and is better than forcing a product into a category it does not belong
in — a wrong category is worse than no category, because everything downstream
trusts it.

Answer for every block.`;

export const chooseSchema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int().min(1).describe('The block number'),
      /** A letter from the options, or "x" for none of them. */
      option: z.string().describe('a, b, c ... or x when none fits'),
    }),
  ),
});

export const categoryChooser = new Agent({
  id: 'category-chooser',
  name: 'category-chooser',
  description: 'Picks a product category from the alternatives the rules ranked.',
  instructions: CHOOSE_INSTRUCTIONS,
  model: google(ENRICHER_MODEL),
});

export const LETTERS = 'abcdefghij';

export interface ChooseItem {
  name: string;
  options: string[];
}

export function choosePrompt(items: ChooseItem[]): string {
  const list = items
    .map((it, i) => {
      const opts = it.options
        .map((o, j) => `       ${LETTERS[j]})  ${o}`)
        .join('\n');
      return `${String(i + 1).padStart(3)}  ${it.name}\n${opts}\n       x)  none of these`;
    })
    .join('\n\n');
  return `Pick the category for each product.\n\n${list}`;
}

// ---------------------------------------------------------------- 3. ask
const ASK_INSTRUCTIONS = `${SHARED}

For each numbered product name, say what the product IS, in Danish, in one to
three words. A product type, not a category path, not a sentence, not the
brand, not the model name.

Write the ordinary Danish word a shop would use. If the name is already Danish,
reuse its own word for the type. If the name is English, give the Danish word:
a poster is a "plakat", a mug is a "krus", a security key is a
"sikkerhedsnoegle".

Write the type in the singular and with no adjectives: "gaming mus" becomes
"mus", "traadloes stoevsuger" becomes "stoevsuger".

If the name genuinely does not say what the thing is — a bare model code, a
gift card, a service — answer with an empty string. That is better than a
guess, because what you write here is matched against a fixed catalogue
structure afterwards and a guess would land somewhere real and wrong.

Answer for every line, using its number.`;

export const askSchema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int().min(1).describe('The line number'),
      type: z.string().describe('One to three Danish words naming the product type, or empty'),
    }),
  ),
});

export const categoryAsker = new Agent({
  id: 'category-asker',
  name: 'category-asker',
  description: 'Says what a product is, in plain Danish, when no rule could tell.',
  instructions: ASK_INSTRUCTIONS,
  model: google(ENRICHER_MODEL),
});

export function askPrompt(names: string[]): string {
  const list = names.map((n, i) => `${String(i + 1).padStart(3)}  ${n}`).join('\n');
  return `What is each of these products?\n\n${list}`;
}

/** The fallback agents, built only when a fallback model is configured. */
function fallbackOf(id: string, instructions: string): Agent | null {
  if (!ENRICHER_FALLBACK_MODEL) return null;
  return new Agent({
    id: `${id}-fallback`,
    name: `${id}-fallback`,
    instructions,
    model: google(ENRICHER_FALLBACK_MODEL),
  });
}

export const categoryConfirmerFallback = fallbackOf('category-confirmer', CONFIRM_INSTRUCTIONS);
export const categoryChooserFallback = fallbackOf('category-chooser', CHOOSE_INSTRUCTIONS);
export const categoryAskerFallback = fallbackOf('category-asker', ASK_INSTRUCTIONS);
