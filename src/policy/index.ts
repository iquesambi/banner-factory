import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * The business rules, as written.
 *
 * A rule is a sentence. There is no schema for it, no list of switches it has
 * to be one of, and nothing here parses it — because the moment a rule has to
 * fit a shape, the shape decides which rules can exist, and the people who
 * know the business are the ones who lose.
 *
 * Order is the whole structure. The list is read top down and a rule above
 * outranks a rule below it, which is the one thing a person can express by
 * dragging rather than by writing. Everything else is language, handed to the
 * compiler agent.
 *
 * The compiled policy is cached against the version it was made from, so the
 * compiler runs when the rules change and not when a banner is made.
 */
export interface Rule {
  id: string;
  text: string;
  enabled: boolean;
}

export interface Compiled {
  policy: string;
  conflicts: string[];
  unusable: string[];
  /** The policy version this was compiled from; stale if it is behind. */
  fromVersion: number;
  at: string;
  model: string;
}

export interface Policy {
  version: number;
  savedAt: string;
  /** Priority order: index 0 is the most important. */
  rules: Rule[];
  compiled: Compiled | null;
}

const PATH = '.cache/policy.json';

/**
 * The rules the project already acts on, written out as sentences.
 *
 * They are defaults, not fixtures: every one of them is editable and
 * droppable, and the first two are only first because that is the order the
 * brief puts them in.
 */
export const DEFAULT_POLICY: Policy = {
  version: 1,
  savedAt: '2026-11-24T00:00:00Z',
  rules: [
    {
      id: 'truth',
      enabled: true,
      text: 'Never show a product whose price or saving we cannot stand behind. If the feed contradicts itself about a discount, do not pick that product.',
    },
    {
      id: 'reuse',
      enabled: true,
      text: 'If one of the candidates already has a banner that is still true today, prefer it. Making a new banner costs money and an existing one costs nothing.',
    },
    {
      id: 'discount',
      enabled: true,
      text: 'A real discount above 30% is worth showing. Between two candidates that both suit the customer, prefer the one actually on offer.',
    },
    {
      id: 'brand',
      enabled: true,
      text: 'Someone who was looking at a brand usually wants that brand. Prefer it, but never force it: a better product from another brand beats a worse one from theirs.',
    },
    {
      id: 'stock',
      enabled: true,
      text: 'Prefer deeper stock. A banner that sends people to the last unit sells one thing and disappoints everyone else who clicks.',
    },
    {
      id: 'variety',
      enabled: true,
      text: 'When the banner is a suggestion rather than a replacement, do not offer the customer another of the thing they were already looking at.',
    },
  ],
  compiled: null,
};

export function loadPolicy(): Policy {
  try {
    if (existsSync(PATH)) return JSON.parse(readFileSync(PATH, 'utf8')) as Policy;
  } catch {
    /* A broken file must not take the page down; the defaults are a fine answer. */
  }
  return DEFAULT_POLICY;
}

export function savePolicy(policy: Policy): Policy {
  const next: Policy = {
    ...policy,
    version: policy.version + 1,
    savedAt: new Date().toISOString(),
    rules: policy.rules.map((r) => ({
      id: r.id || randomUUID().slice(0, 8),
      text: r.text,
      enabled: r.enabled,
    })),
  };
  mkdirSync('.cache', { recursive: true });
  writeFileSync(PATH, JSON.stringify(next, null, 2));
  return next;
}

/** The rules the compiler sees: enabled, in order, with the empty ones dropped. */
export function activeRules(policy: Policy): string[] {
  return policy.rules.filter((r) => r.enabled && r.text.trim()).map((r) => r.text.trim());
}

/**
 * Whether the cached policy still matches the rules.
 *
 * A stale policy is worse than none, because it reads like the rules and acts
 * like the old ones. Everything that uses it checks this first.
 */
export function isStale(policy: Policy): boolean {
  return !policy.compiled || policy.compiled.fromVersion !== policy.version;
}
