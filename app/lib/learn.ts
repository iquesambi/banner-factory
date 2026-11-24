import 'server-only';
import {
  loadExperiments, saveExperiments, type Experiment,
} from '@/src/experiment/index.js';
import { pct } from '@/src/experiment/stats.js';
import { addLessons, PROMPT_FOR_DIMENSION, type Lesson } from '@/src/improve/lessons.js';
import { whatOf } from './measure.js';

/**
 * Turning finished tests into evidence the prompt loop can read.
 *
 * This is the join between the two halves of the system: the measurement
 * tool finds out what real people did, and the improvement loop rewrites the
 * instructions that produced it. Without this, a test would end in a number
 * on a screen and nothing would ever change because of it.
 *
 * Called when a test is stopped, and safe to call again: a lesson is keyed
 * on its experiment, so nothing is counted twice.
 */
export function learnFromExperiments(): Lesson[] {
  const book = loadExperiments();
  const fresh: Lesson[] = [];

  for (const e of book.experiments) {
    if (e.state !== 'decided' || !e.decision || e.learnedAt) continue;
    fresh.push(lessonOf(e));
  }
  if (!fresh.length) return [];

  addLessons(fresh);
  const at = new Date().toISOString();
  saveExperiments({
    ...book,
    experiments: book.experiments.map((e) =>
      fresh.some((l) => l.id === e.id) ? { ...e, learnedAt: at } : e,
    ),
  });
  return fresh;
}

function lessonOf(e: Experiment): Lesson {
  const d = e.decision!;
  const outcome: Lesson['outcome'] =
    d.winner === 'variant' ? 'the variant won'
    : d.winner === 'control' ? 'the variant lost'
    : 'no difference was found';

  const detail =
    d.reading === 'conclusive'
      ? `${pct(d.relativeLift, 1)} against the control over ${d.impressions} impressions, p = ${d.p.toFixed(3)}`
      : `${d.impressions} impressions, p = ${d.p.toFixed(3)}, stopped ${d.reading === 'peek' ? 'before the planned sample' : 'without a measurable difference'}`;

  return {
    id: e.id,
    at: d.at,
    promptId: PROMPT_FOR_DIMENSION[e.change.dimension] ?? 'copywriter',
    product: e.product,
    dimension: e.change.dimension,
    what: whatOf(e.change),
    hypothesis: e.change.hypothesis,
    outcome,
    detail,
    simulated: d.source === 'simulated',
    usedAt: null,
  };
}
