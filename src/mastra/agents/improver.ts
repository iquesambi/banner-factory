/**
 * The improver: the only agent whose job is another agent's instructions.
 *
 * It runs on a bigger model than the ones it writes for, and that asymmetry
 * is deliberate. A banner is made dozens of times a day by a cheap model, and
 * the instructions it follows are written once in a while by an expensive one
 * reading everything that went wrong. Paying pro rates per banner would be
 * waste; paying them per prompt is the cheapest leverage in the system.
 *
 * It is given the baseline — the instructions under source control — the
 * revision currently live if there is one, and every judged banner since that
 * revision took effect, with what the agent produced and what the person said
 * about it. It returns the complete new instructions, or declines.
 *
 * Declining matters. Most feedback does not imply a prompt change: three
 * people disliking three banners for three unrelated reasons is noise, and an
 * instruction written from noise makes the prompt longer and the output
 * worse. The agent is told that saying "nothing here generalises" is a good
 * answer, because an improver that always finds something to change is a
 * random walk with a model attached.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

/** A better model than the agents it writes for, which is the whole point. */
export const IMPROVER_MODEL = process.env.IMPROVER_MODEL ?? 'gemini-4-carbon';

const IMPROVER_INSTRUCTIONS = `You improve the instructions given to a writing or design agent that
produces retail banners. You are not writing a banner. You are writing the
instructions somebody else follows to write banners.

WHAT YOU ARE GIVEN

The baseline instructions, which are the version under source control. The
instructions currently in force, if they already differ from the baseline.
And the evidence: banners this agent produced, what it produced on each one,
and the verdict a person left — approved, or not.

Some verdicts are worth more than others, and you are told which is which. A
thumb is a click. A redo is somebody who disliked the output enough to spend
money having it made again. Weigh them accordingly.

WHAT YOU ARE LOOKING FOR

A pattern, not an incident. The question is never "was this banner bad" — it
is "does the same thing go wrong across several of these, and is it something
the instructions could have prevented".

Three complaints with three unrelated causes are not a pattern, and the right
answer then is to change nothing. Two complaints that are plainly the same
mistake are a pattern even though there are only two.

If you are shown finished A/B tests, they outrank everything else here.
Those are real customers choosing between two banners, measured, with a
p-value attached. An opinion that contradicts a conclusive test is an opinion
that was wrong. A test that found no difference tells you that dimension is
not where the problem is, and writing an instruction about it would be noise
dressed as evidence.

Look at the approvals as well. They tell you what the current instructions get
right, and anything you change has to keep getting it right. An improvement
that fixes the complaints and breaks the approvals is a loss.

WHAT A GOOD CHANGE LOOKS LIKE

Specific. "Write better headlines" instructs nobody. "A headline that names
only the category reads as generic; name the product or the one thing that
makes it worth buying" can be followed.

Additive where it can be, and replacing where it must. If an existing
paragraph is the cause of the complaints, rewrite that paragraph. Do not leave
it in place and add a contradicting one: an instruction set that argues with
itself produces whichever side the model noticed last.

Short. Every sentence you add competes for attention with every sentence
already there. If you cannot say which existing sentence your new one is more
important than, it probably should not go in.

WHAT YOU MUST NOT TOUCH

The parts of the instructions that keep the output TRUE and WELL FORMED are
not yours to soften, whatever the feedback says. Rules about never inventing
numbers, only using facts that were given, copying a value exactly from a
closed list, not contradicting a stated condition, and writing in the language
asked for: these stay, in force and in substance. You may reword them for
clarity. You may not weaken, narrow or remove them, and you may not add
anything that works against them.

Feedback asking for something untrue — a louder discount than the product has,
urgency that is not real — is feedback you refuse, and you say so in your note
rather than acting on it.

OUTPUT

"instructions": the COMPLETE new instructions, ready to be used as they
stand. Not a diff, not a list of edits. If you are declining, repeat the
current instructions unchanged.

"declined": true when the evidence does not support a change.

"note": one short paragraph, for a person deciding whether to accept this. Say
what pattern you found, what you changed, and what you deliberately left
alone. If you declined, say what the feedback looked like and why it does not
generalise.

"changes": one line per substantive change, in plain words.`;

export const improverSchema = z.object({
  instructions: z.string(),
  declined: z.boolean(),
  note: z.string(),
  changes: z.array(z.string()),
});

export type ImproverAnswer = z.infer<typeof improverSchema>;

export const improver = new Agent({
  id: 'improver',
  name: 'improver',
  instructions: IMPROVER_INSTRUCTIONS,
  model: google(IMPROVER_MODEL),
});

export interface ImproverCase {
  /** What the banner was about. */
  context: string;
  /** What this agent produced on it. */
  output: string;
  verdict: 'approved' | 'rejected';
  /** `a click` or `a paid rerun`. */
  weight: string;
}

export function improverPrompt(input: {
  agent: string;
  role: string;
  baseline: string;
  current: string | null;
  cases: ImproverCase[];
  /** Finished A/B tests: what real traffic preferred, and what it did not. */
  measured?: string[];
}): string {
  const lines: string[] = [];
  lines.push(`The agent whose instructions you are improving: ${input.agent}`);
  lines.push(`What it does: ${input.role}`);
  lines.push('');
  lines.push('=== BASELINE INSTRUCTIONS (under source control) ===');
  lines.push(input.baseline);
  lines.push('');
  if (input.current) {
    lines.push('=== CURRENTLY IN FORCE (a revision already replaced the baseline) ===');
    lines.push(input.current);
    lines.push('');
    lines.push('Improve the instructions currently in force, not the baseline.');
    lines.push('');
  }

  const rejected = input.cases.filter((c) => c.verdict === 'rejected');
  const approved = input.cases.filter((c) => c.verdict === 'approved');

  lines.push(`=== THE COMPLAINTS (${rejected.length}) ===`);
  rejected.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.context}   [${c.weight}]`);
    lines.push(indent(c.output));
    lines.push('');
  });

  lines.push(`=== THE APPROVALS (${approved.length}) — do not break these ===`);
  approved.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.context}`);
    lines.push(indent(c.output));
    lines.push('');
  });

  if (input.measured?.length) {
    lines.push(`=== WHAT REAL TRAFFIC SAID (${input.measured.length}) ===`);
    lines.push('These are finished A/B tests on live banners. A result here outweighs');
    lines.push('any number of opinions above it, including your own reading of the copy.');
    lines.push('A test that found no difference is also a result: it means that thing is');
    lines.push('not what is wrong, and an instruction about it would be noise.');
    lines.push('');
    for (const m of input.measured) lines.push(`- ${m}`);
    lines.push('');
  }

  lines.push('Write the instructions, or decline.');
  return lines.join('\n');
}

function indent(text: string): string {
  return text.split('\n').map((l) => `    ${l}`).join('\n');
}
