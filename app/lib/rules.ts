import 'server-only';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

/**
 * The two switches that cannot be a prompt.
 *
 * Everything about WHICH product goes on a banner is written text now, read
 * by the policy agents in `src/policy`. These two are not that. They decide
 * whether a run happens at all — whether an existing banner is reused instead
 * of making a new one — and that is settled before there are any candidates
 * for a policy to choose between, and before any model has been paid.
 *
 * So they stay mechanical, and they stay here. Writing them as sentences
 * would mean asking a model whether to call a model.
 */
export interface ReuseRules {
  version: number;
  savedAt: string;
  /** Reuse a banner already made from this very seed, in this language. */
  reuseSeed: boolean;
  /**
   * How far down the recommender's own list to accept an existing banner.
   * 0 switches it off; 2 means the first or second choice will do.
   */
  reuseDepth: number;
}

const PATH = '.cache/reuse-rules.json';

export const DEFAULT_REUSE: ReuseRules = {
  version: 1,
  savedAt: '2026-11-24T00:00:00Z',
  reuseSeed: true,
  reuseDepth: 2,
};

/**
 * Reads the current switches, including from the older three-lane file.
 *
 * That file held these two inside a `tieBreak` list alongside rules that are
 * now written text. Migrating on read means nobody has to remember to run
 * anything, and the old file simply stops being consulted once this one is
 * written.
 */
export function loadRules(): ReuseRules {
  try {
    if (existsSync(PATH)) return JSON.parse(readFileSync(PATH, 'utf8')) as ReuseRules;
  } catch {
    /* fall through */
  }
  try {
    if (existsSync('.cache/rules.json')) {
      const old = JSON.parse(readFileSync('.cache/rules.json', 'utf8')) as {
        tieBreak?: Array<{ id: string; enabled: boolean; value?: string }>;
      };
      const seed = old.tieBreak?.find((t) => t.id === 'reuseSeed');
      const list = old.tieBreak?.find((t) => t.id === 'hasBanner');
      return {
        ...DEFAULT_REUSE,
        reuseSeed: seed?.enabled ?? DEFAULT_REUSE.reuseSeed,
        reuseDepth: list?.enabled ? Number(list.value ?? 2) || 0 : 0,
      };
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_REUSE;
}

export function saveRules(rules: ReuseRules): ReuseRules {
  const next: ReuseRules = {
    reuseSeed: rules.reuseSeed,
    reuseDepth: Math.max(0, Math.min(10, Math.floor(rules.reuseDepth))),
    version: rules.version + 1,
    savedAt: new Date().toISOString(),
  };
  mkdirSync('.cache', { recursive: true });
  writeFileSync(PATH, JSON.stringify(next, null, 2));
  return next;
}
