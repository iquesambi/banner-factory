/**
 * The business rules, as two agents and no code.
 *
 * Every earlier attempt at this split the rules into lanes — what must be
 * true, what is preferred, how to break a tie — and made the first lane
 * executable. That bought determinism and cost the thing that matters: a
 * person could only express a rule the code already had a switch for.
 *
 * Here a rule is a sentence someone writes. Order is the only structure: the
 * list is read top down and a rule above outranks a rule below it. Nothing is
 * parsed, nothing is matched, nothing is compiled into a filter.
 *
 * Two agents, because writing a policy and applying one are different jobs.
 *
 *   compiler  reads the ordered rules once and writes the policy a judge can
 *             apply: it resolves the ranking into language, names the
 *             conflicts it found, and says what to do when rules disagree.
 *             It runs when the rules change, not when a banner is made.
 *
 *   judge     receives that policy and the candidates a run produced, and
 *             picks one. It answers with an INDEX, so it cannot name a
 *             product that was not offered, and it says which rule decided
 *             it — which is what makes a policy reviewable rather than a
 *             black box.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const POLICY_MODEL =
  process.env.POLICY_MODEL ?? process.env.RECOMMENDER_MODEL ?? 'gemini-3.5-flash-lite';

export const POLICY_FALLBACK_MODEL = process.env.POLICY_FALLBACK_MODEL ?? '';

/* --------------------------------------------------------------- compiler */

const COMPILER_INSTRUCTIONS = `You turn a list of business rules into the policy another agent will apply
when it chooses which product goes on a retargeting banner for Elgiganten, a
Nordic electronics and appliance retailer.

The rules arrive in priority order. The first is the most important and the
last is the least. That order is the only thing that settles a disagreement
between them, and it is not negotiable: you may not decide that a lower rule
is really more important.

WHAT TO WRITE

A policy the other agent can follow while looking at a list of products. Write
it as instructions to that agent, in the second person, in English.

Keep every rule's meaning. Do not add rules of your own, do not soften one you
disagree with, and do not quietly drop one you find vague — a vague rule is
still the rule, so say plainly how to apply it and what it cannot settle.

Make the ranking explicit where it matters. If rule 2 would pick one product
and rule 5 another, the policy must say that rule 2 wins. Do not merely list
the rules back in order and leave the arbitration to chance.

Say what to do when no rule distinguishes the candidates: keep the order they
arrived in, which is the recommender's own ranking on merit.

CONFLICTS

Where two rules can demand opposite things, name the pair and say how the
order resolves it. This is the most useful thing you produce, because a person
writing rules one at a time cannot see the pairs.

WHAT THE JUDGE CAN SEE

It is shown the product the customer was looking at — its name, brand,
category, price, previous price and saving, whether it is in stock and how
deep, its premium tier, its energy class, and its sales point — and the same
for every candidate.

The SALES POINT is the retailer's own label on a product and is worth knowing
about, because several real rules live only there. It is Danish and it is
short. "Klubpris 1499" means that price is for members only. "Maks 1 pr.
kunde" is a purchase limit. "Spar 500" states a saving, and when it disagrees
with the saving field the feed is contradicting itself.

Where a rule cannot be checked from any of that, say so. Do not pretend it
can be applied.

Be brief. A policy that runs to pages gets skimmed. Aim for what a shop
manager could hold in their head.`;

export const policyCompileSchema = z.object({
  policy: z.string().describe('The instructions the judge will follow'),
  conflicts: z
    .array(z.string())
    .describe('Pairs of rules that can demand opposite things, and how order settles them'),
  unusable: z
    .array(z.string())
    .describe('Rules that cannot be checked from what a candidate shows'),
});

export type PolicyCompilation = z.infer<typeof policyCompileSchema>;

export const policyCompiler = new Agent({
  id: 'policy-compiler',
  name: 'policy-compiler',
  description: 'Turns an ordered list of written business rules into a policy another agent applies.',
  instructions: COMPILER_INSTRUCTIONS,
  model: google(POLICY_MODEL),
});

export function compilePrompt(rules: string[]): string {
  const list = rules.map((r, i) => `${i + 1}. ${r.trim()}`).join('\n');
  return `These are the business rules, most important first:

${list}

Write the policy.`;
}

/* ------------------------------------------------------------------ judge */

const JUDGE_INSTRUCTIONS = `You choose which product goes on a retargeting banner for Elgiganten, a Nordic
electronics and appliance retailer.

You are given the product the customer was looking at, a policy written from
the business's own rules, and a numbered list of candidates that an earlier
step already judged to be reasonable. Your job is not to judge them again on
merit. It is to apply the policy.

The seed product is there as context, not as a candidate. Whether it was in
stock changes what the banner is for: out of stock means the banner replaces
it, in stock means the banner suggests something alongside it.

The SALES POINT, where a product has one, is the retailer's own Danish label.
"Klubpris" is a members-only price, "Maks N pr. kunde" is a purchase limit,
"Spar N" states a saving. Read it when the policy asks you to.

The candidates arrive in the order the earlier step ranked them. That order is
the tie-break: when the policy does not distinguish two candidates, the one
that arrived first wins. Do not reshuffle on taste.

Answer with the NUMBER of the candidate you choose, never a name or a code.

Say which part of the policy decided it, in one short sentence. If the policy
did not decide — if you kept the first because nothing distinguished them —
say that plainly. A policy that turns out not to decide anything is a useful
thing to learn, and pretending otherwise hides it.

Never choose a candidate that is not on the list, and never refuse to choose:
every candidate here was already found acceptable, so the worst outcome is
the first one.`;

export const policyJudgeSchema = z.object({
  item: z.number().int().min(1).describe('The candidate number'),
  because: z.string().describe('Which part of the policy decided it, in one sentence'),
  decided: z
    .boolean()
    .describe('True when the policy chose; false when nothing distinguished the candidates'),
});

export type PolicyVerdict = z.infer<typeof policyJudgeSchema>;

export const policyJudge = new Agent({
  id: 'policy-judge',
  name: 'policy-judge',
  description: 'Applies the compiled business policy to the candidates a run produced.',
  instructions: JUDGE_INSTRUCTIONS,
  model: google(POLICY_MODEL),
});

export const policyJudgeFallback = POLICY_FALLBACK_MODEL
  ? new Agent({
      id: 'policy-judge-fallback',
      name: 'policy-judge-fallback',
      instructions: JUDGE_INSTRUCTIONS,
      model: google(POLICY_FALLBACK_MODEL),
    })
  : null;

/**
 * What the judge is shown about a product.
 *
 * Deliberately everything the feed states about it and nothing derived. A
 * rule written about members-only pricing or a purchase limit can only be
 * applied if the label that carries it reaches the prompt, and those live in
 * `salesPoint` and nowhere else.
 */
export interface JudgeProduct {
  name: string;
  brand: string | null;
  category: string | null;
  price: number;
  oldPrice: number | null;
  saveAmount: number | null;
  discountPct: number;
  stockBand: string;
  tier: number | null;
  energyClass: string | null;
  /** The retailer's own label: "Klubpris 1499", "Maks 1 pr. kunde", "Spar 500". */
  salesPoint: string | null;
}

export interface JudgeCandidate extends JudgeProduct {
  /** Why the earlier step offered it, which is context the policy may use. */
  reason: string;
}

export interface JudgePromptInput {
  policy: string;
  /** 'substitute' replaces a product out of stock; 'suggest' offers alongside one in stock. */
  mode: 'substitute' | 'suggest';
  seed: JudgeProduct;
  candidates: JudgeCandidate[];
}

const STOCK_BANDS = ['100+', '50+', '25+', '5+', '<5'];

/** One line of facts, with the fields a product does not have left out. */
function facts(p: JudgeProduct): string[] {
  const inStock = STOCK_BANDS.includes(p.stockBand.trim());
  return [
    `price ${p.price} kr`,
    p.oldPrice !== null && p.oldPrice > p.price ? `was ${p.oldPrice} kr` : null,
    p.saveAmount !== null && p.saveAmount > 0 ? `saving ${p.saveAmount} kr` : null,
    p.discountPct > 0 ? `${p.discountPct}% off` : 'no discount',
    inStock ? `in stock (${p.stockBand.trim()})` : 'OUT OF STOCK',
    p.tier !== null ? `tier ${p.tier}` : null,
    p.brand ? `brand ${p.brand}` : null,
    p.energyClass ? `energy ${p.energyClass}` : null,
    p.salesPoint?.trim() ? `sales point "${p.salesPoint.trim()}"` : null,
  ].filter((x): x is string => x !== null);
}

export function judgePrompt(input: JudgePromptInput): string {
  const { policy, mode, seed, candidates } = input;

  const seedFacts = facts(seed).map((f) => `  ${f}`).join('\n');
  const where = seed.category ? `\n  in ${seed.category}` : '';

  const situation = mode === 'suggest'
    ? `THE PRODUCT THE CUSTOMER WAS LOOKING AT, which IS in stock:

  ${seed.name}${where}
${seedFacts}

Nothing needs replacing, so the banner is a suggestion alongside it.`
    : `THE PRODUCT THE CUSTOMER WAS LOOKING AT, which is OUT of stock:

  ${seed.name}${where}
${seedFacts}

The banner has to offer something instead of it.`;

  const list = candidates
    .map((c, i) =>
      `${String(i + 1).padStart(2)}  ${c.name}\n`
      + `     ${facts(c).join('  ·  ')}\n`
      + `     offered because: ${c.reason}`,
    )
    .join('\n\n');

  return `${situation}

THE POLICY

${policy}

CANDIDATES, in the order the earlier step ranked them:

${list}

Apply the policy and choose one.`;
}
