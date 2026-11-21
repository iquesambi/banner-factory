import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';

/**
 * Model id is configurable because the challenge ships a Gemini key with a
 * fixed budget: classification runs on the cheapest tier, banner copy does not.
 */
export const VALIDATOR_MODEL = process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

export function hasApiKey(): boolean {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
  );
}

/**
 * Picks a category from a closed list of options. It never writes a category
 * name: it returns the index of the option it chose, which keeps output at a
 * couple of tokens and makes a hallucinated answer impossible to represent.
 */
export const categoryValidator = new Agent({
  id: 'category-validator',
  name: 'category-validator',
  description:
    'Confirms or corrects the category of an Elgiganten product, choosing from a fixed list.',
  instructions: `You classify products from a Danish electronics retailer (Elgiganten).

You receive a product name and a numbered list of candidate categories from the
retailer's own taxonomy. Pick the ONE option that best describes what the
product actually is.

Rules:
- Answer with the index of your chosen option. Never invent a category.
- Judge what the product IS, not what it is compatible with or themed on.
  A phone case is an accessory, not a phone. A LEGO set of a video game is a
  toy, not a game. Printer ink is ink, not paper.
- Danish compounds are head-final: the last part carries the type.
  "netvaerksswitch" is a switch; "toerretumbler" is a tumble dryer.
- If none of the options fits the product, answer with index -1.
- confidence is "high" only when the name clearly states the product type.
  Use "low" when you are inferring from a brand or model name alone.`,
  model: google(VALIDATOR_MODEL),
});
