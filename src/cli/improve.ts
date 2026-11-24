/**
 * The improvement loop, from the terminal.
 *
 *   npm run improve                     what each prompt is waiting for
 *   npm run improve -- copywriter       run the loop for one prompt
 *   npm run improve -- copywriter --force      ignore the window
 *   npm run improve -- copywriter --no-eval    propose without comparing
 *   npm run improve -- --promote=copywriter    a person accepts the candidate
 *   npm run improve -- --reject=copywriter     a person refuses it
 *   npm run improve -- --rollback=copywriter   undo what is live
 *   npm run improve -- --approval=auto|human   who decides from now on
 *   npm run improve -- --show=copywriter       print the instructions in force
 *
 * Running it costs money: a pro model reads the feedback, and the eval makes
 * two cheap calls and one pro call per product compared. Nothing in this
 * project calls it on a schedule.
 */
import {
  activeRevision, candidateOf, loadPrompts, promote, recordOf, reject, rollBack,
  savePrompts, isPromptId, type PromptId,
} from '../prompts/index.js';
import { PROMPT_META } from '../prompts/registry.js';
import { improvePrompt, statusOf } from '../improve/run.js';
import { verdictLine } from '../improve/eval.js';

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name: string) => args.includes(`--${name}`);

const who = process.env.USER ? `human:${process.env.USER}` : 'human';

function asId(value: string | null, what: string): PromptId {
  if (!isPromptId(value)) {
    console.error(`${what}: expected one of ${Object.keys(PROMPT_META).join(', ')}`);
    process.exit(1);
  }
  return value;
}

/* ------------------------------------------------- the decisions a person makes */

const approval = flag('approval');
if (approval === 'auto' || approval === 'human') {
  savePrompts({ ...loadPrompts(), approval });
  console.log(
    approval === 'auto'
      ? 'A candidate the reviewer prefers will now go live on its own.'
      : 'Every candidate now waits for a person, however the reviewer judged it.',
  );
  process.exit(0);
}

const show = flag('show');
if (show !== null) {
  const id = asId(show, '--show');
  const active = activeRevision(loadPrompts(), id);
  console.log(active ? `# ${id} v${active.version}, live since ${active.at}\n` : `# ${id} baseline\n`);
  console.log(active?.text ?? PROMPT_META[id].baseline);
  process.exit(0);
}

const toPromote = flag('promote');
if (toPromote !== null) {
  const id = asId(toPromote, '--promote');
  const book = loadPrompts();
  const candidate = candidateOf(book, id);
  if (!candidate) {
    console.error(`${id} has no candidate waiting.`);
    process.exit(1);
  }
  savePrompts(promote(book, id, candidate.version, who));
  console.log(`${id} v${candidate.version} is live. Every banner from now on uses it.`);
  process.exit(0);
}

const toReject = flag('reject');
if (toReject !== null) {
  const id = asId(toReject, '--reject');
  const book = loadPrompts();
  const candidate = candidateOf(book, id);
  if (!candidate) {
    console.error(`${id} has no candidate waiting.`);
    process.exit(1);
  }
  savePrompts(reject(book, id, candidate.version, who));
  const window = recordOf(loadPrompts(), id).window;
  console.log(`${id} v${candidate.version} refused. The next attempt waits for ${window} verdicts.`);
  process.exit(0);
}

const toRollBack = flag('rollback');
if (toRollBack !== null) {
  const id = asId(toRollBack, '--rollback');
  const book = loadPrompts();
  const active = activeRevision(book, id);
  if (!active) {
    console.error(`${id} is already on the baseline.`);
    process.exit(1);
  }
  savePrompts(rollBack(book, id, who));
  const now = activeRevision(loadPrompts(), id);
  console.log(`${id} is back on ${now ? `v${now.version}` : 'the baseline'}.`);
  process.exit(0);
}

/* ------------------------------------------------------------------ status */

const target = args.find((a) => !a.startsWith('--')) ?? null;

if (!target) {
  const book = loadPrompts();
  console.log(`Approval: ${book.approval === 'auto' ? 'the reviewer may promote' : 'a person promotes'}\n`);
  for (const row of statusOf(book)) {
    const live = row.active ? `v${row.active.version}` : 'baseline';
    console.log(`${row.meta.label.padEnd(14)} ${live.padEnd(9)} ${row.evidence.why}`);
    if (row.candidate) {
      const ev = row.candidate.evaluation;
      console.log(
        `${''.padEnd(14)} candidate v${row.candidate.version} waiting · ${ev ? verdictLine(ev) : 'not evaluated'}`,
      );
    }
    if (row.evidence.redos) {
      console.log(`${''.padEnd(14)} ${row.evidence.redos} of the complaints were paid reruns`);
    }
  }
  console.log('\nRun one with:  npm run improve -- <prompt> [--force] [--no-eval]');
  process.exit(0);
}

/* -------------------------------------------------------------- the loop */

const id = asId(target, 'prompt');
const result = await improvePrompt(id, {
  force: has('force'),
  skipEval: has('no-eval'),
  onProgress: (line) => console.log(`  ${line}`),
});

console.log(`\n${result.outcome.toUpperCase()}  ${result.headline}`);
if (result.note) console.log(`\n${result.note}`);
if (result.changes.length) {
  console.log('\nWhat changed:');
  for (const c of result.changes) console.log(`  - ${c}`);
}
if (result.cases.length) {
  console.log('\nCase by case:');
  for (const c of result.cases) {
    console.log(`  ${c.better.padEnd(9)} ${c.product} (${c.from}) — ${c.because}`);
    for (const b of c.broken) console.log(`            broke: ${b}`);
  }
}
if (result.usd !== null) {
  console.log(`\nThis run cost ${(result.usd * 100).toFixed(2)} cents over ${result.calls} calls.`);
}
if (result.outcome === 'awaiting-human') {
  console.log(`\nAccept it with:  npm run improve -- --promote=${id}`);
  console.log(`Refuse it with:  npm run improve -- --reject=${id}`);
}
