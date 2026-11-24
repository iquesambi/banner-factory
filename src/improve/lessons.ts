/**
 * What the tests taught, kept where the prompt loop can read it.
 *
 * A thumb on the board is one person's opinion of one banner. A finished
 * A/B test is thousands of strangers choosing, and it belongs in the same
 * conversation — so a decided experiment is written here as a lesson, and
 * the improver reads lessons alongside the verdicts.
 *
 * Two rules that matter more than the plumbing:
 *
 *   - A lesson from SIMULATED traffic is recorded and never fed to the
 *     improver. The simulator exists so the loop can be exercised without a
 *     live site; letting its output rewrite the prompts would mean the
 *     system learning from itself and calling it evidence.
 *
 *   - A test that found no difference is a lesson too, and a valuable one.
 *     It is the only thing that stops the next researcher proposing the same
 *     idea, and the only honest record of how most tests actually end.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { PromptId } from '../prompts/index.js';

export interface Lesson {
  /** The experiment it came from, so it is written once. */
  id: string;
  at: string;
  /** Whose instructions this is evidence about. */
  promptId: PromptId;
  product: string;
  dimension: string;
  what: string;
  hypothesis: string;
  outcome: 'the variant won' | 'the variant lost' | 'no difference was found';
  /** The numbers, in words. */
  detail: string;
  simulated: boolean;
  /** Set when an improvement run has read it. */
  usedAt: string | null;
}

const PATH = '.cache/lessons.json';

export function loadLessons(): Lesson[] {
  try {
    if (existsSync(PATH)) return JSON.parse(readFileSync(PATH, 'utf8')) as Lesson[];
  } catch {
    /* a broken file must not stop a banner being made */
  }
  return [];
}

export function saveLessons(lessons: Lesson[]): void {
  mkdirSync('.cache', { recursive: true });
  writeFileSync(PATH, JSON.stringify(lessons, null, 2));
}

export function addLessons(lessons: Lesson[]): Lesson[] {
  const held = loadLessons();
  const known = new Set(held.map((l) => l.id));
  const next = [...held, ...lessons.filter((l) => !known.has(l.id))];
  if (next.length !== held.length) saveLessons(next);
  return next;
}

/** Which agent's instructions a dimension is evidence about. */
export const PROMPT_FOR_DIMENSION: Record<string, PromptId> = {
  copy: 'copywriter',
  cta: 'copywriter',
  layout: 'art-director',
};

/** The lessons an improvement run should read for this prompt: real, and unread. */
export function unusedFor(promptId: PromptId, lessons = loadLessons()): Lesson[] {
  return lessons.filter((l) => l.promptId === promptId && !l.usedAt && !l.simulated);
}

export function markUsed(ids: string[]): void {
  if (!ids.length) return;
  const at = new Date().toISOString();
  saveLessons(loadLessons().map((l) => (ids.includes(l.id) ? { ...l, usedAt: at } : l)));
}

/** One line, as the improver and the screen both want to read it. */
export function lessonLine(l: Lesson): string {
  return `${l.product} — tried ${l.what} because "${l.hypothesis}" — ${l.outcome}: ${l.detail}`;
}
