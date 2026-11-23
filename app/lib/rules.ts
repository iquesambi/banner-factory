import 'server-only';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { TagStore } from '@/src/store/index.js';
import type { TaggedProduct } from '@/src/types.js';

/**
 * The filter lane, as code.
 *
 * Only column 1 of the three lanes lives here, and that is the point: what
 * has to be true runs deterministically, so it can be rehearsed for free and
 * cannot be talked out of by a model. The choosing lane becomes prompt text
 * and the tie-break lane runs after the model; neither is executable here.
 *
 * Note the gap, which is real: this engine is not yet wired into the
 * recommend workflow, which still builds its pool with the same rules
 * hardcoded. The lab below tells the truth about the catalogue; it does not
 * yet change what a run does.
 */

export type FilterId =
  | 'inStock'
  | 'hasPhoto'
  | 'sameCategory'
  | 'sameTier'
  | 'minStock'
  | 'priceBand'
  | 'noClubPrice'
  | 'noPurchaseLimit';

export interface FilterRule {
  id: FilterId;
  label: string;
  /** Required rules cannot be switched off: the brief demands them. */
  required: boolean;
  enabled: boolean;
  /** The one parameter a rule takes, where it takes one. */
  value?: string;
  note?: string;
}

export interface RuleSet {
  version: number;
  savedAt: string;
  filter: FilterRule[];
  /** Column 2: these become sentences in the recommender's prompt. */
  choose: Array<{ id: string; label: string; enabled: boolean; sentence: string }>;
  /** Column 3: deterministic reordering of what the model already approved. */
  tieBreak: Array<{ id: string; label: string; enabled: boolean; value?: string }>;
}

const PATH = '.cache/rules.json';

export const DEFAULT_RULES: RuleSet = {
  version: 3,
  savedAt: '2026-11-18T00:00:00Z',
  filter: [
    { id: 'inStock', label: 'In stock only', required: true, enabled: true },
    { id: 'hasPhoto', label: 'Must have a photograph', required: true, enabled: true },
    { id: 'sameCategory', label: 'Same category', required: false, enabled: true },
    { id: 'sameTier', label: 'Same premium tier', required: false, enabled: true },
    { id: 'minStock', label: 'Minimum stock', required: false, enabled: false, value: '25+' },
    { id: 'priceBand', label: 'Price within', required: false, enabled: false, value: '20' },
    { id: 'noClubPrice', label: 'Exclude club price', required: false, enabled: false, note: '17 products in the feed' },
    { id: 'noPurchaseLimit', label: 'Exclude purchase limits', required: false, enabled: false, note: '11 products in the feed' },
  ],
  choose: [
    { id: 'sameBrand', label: 'Prefer the same brand', enabled: true, sentence: 'Someone who chose a brand usually wants that brand; prefer it, without forcing it.' },
    { id: 'deepStock', label: 'Prefer deeper stock', enabled: true, sentence: 'Between equivalent substitutes, prefer the one with deeper stock.' },
    { id: 'noDowngrade', label: 'Do not drop a generation', enabled: true, sentence: 'Do not offer an earlier generation of the same line unless there is no alternative.' },
    { id: 'campaign', label: 'Prefer the live campaign', enabled: false, sentence: 'Products in the live campaign are marked; prefer them when they are an equally good substitute.' },
  ],
  tieBreak: [
    { id: 'hasBanner', label: 'Already has a banner', enabled: true, value: '2' },
    { id: 'cheapest', label: 'Cheapest first', enabled: false },
    { id: 'deepestStock', label: 'Deepest stock first', enabled: false },
  ],
};

export function loadRules(): RuleSet {
  try {
    if (existsSync(PATH)) return JSON.parse(readFileSync(PATH, 'utf8')) as RuleSet;
  } catch {
    /* fall through to the defaults rather than failing the page */
  }
  return DEFAULT_RULES;
}

export function saveRules(rules: RuleSet): RuleSet {
  const next = { ...rules, version: rules.version + 1, savedAt: new Date().toISOString() };
  mkdirSync('.cache', { recursive: true });
  writeFileSync(PATH, JSON.stringify(next, null, 2));
  return next;
}

/* ----------------------------------------------------------- the rehearsal */

const BANDS = ['100+', '50+', '25+', '5+', '<5'];
const rank = (band: string) => BANDS.indexOf(band.trim());
const inStock = (p: TaggedProduct) => BANDS.includes(p.stockBand.trim());

export interface FunnelStep {
  rule: string;
  dropped: number;
  left: number;
  /** The rule that took the pool to nothing: the one worth looking at. */
  fatal: boolean;
}

export interface Rehearsal {
  seed: { sku: string; name: string; price: number; tier: number | null; stockBand: string };
  funnel: FunnelStep[];
  /** What reached the final rule, so the damage is nameable rather than a count. */
  lastSurvivors: Array<{ sku: string; name: string; price: number; stockBand: string; dropped: boolean }>;
  left: number;
}

let store: TagStore | null = null;
function catalogue(): TagStore {
  if (!store) store = new TagStore().load();
  return store;
}

export function rehearse(sku: string, rules: RuleSet): Rehearsal | null {
  const all = catalogue().all();
  const seed = all.find((p) => p.sku === sku);
  if (!seed) return null;

  const on = (id: FilterId) => rules.filter.find((f) => f.id === id)?.enabled ?? false;
  const valueOf = (id: FilterId) => rules.filter.find((f) => f.id === id)?.value ?? '';

  let pool = all.filter((p) => p.sku !== seed.sku && p.category === seed.category);
  const funnel: FunnelStep[] = [];
  let previous: TaggedProduct[] = pool;

  const apply = (label: string, keep: (p: TaggedProduct) => boolean) => {
    previous = pool;
    const before = pool.length;
    pool = pool.filter(keep);
    funnel.push({ rule: label, dropped: before - pool.length, left: pool.length, fatal: before > 0 && pool.length === 0 });
  };

  funnel.push({ rule: 'In this category', dropped: 0, left: pool.length, fatal: false });
  apply('In stock only', inStock);
  if (on('hasPhoto')) apply('Must have a photograph', (p) => Boolean(p.image));
  if (on('sameTier')) apply('Same premium tier', (p) => p.tier === seed.tier);
  if (on('minStock')) {
    const band = valueOf('minStock');
    apply(`Minimum stock ${band}`, (p) => rank(p.stockBand) <= rank(band) && rank(p.stockBand) >= 0);
  }
  if (on('priceBand')) {
    const pct = Number(valueOf('priceBand')) || 20;
    apply(`Price within ${pct}%`, (p) => Math.abs(p.price - seed.price) <= seed.price * (pct / 100));
  }
  if (on('noClubPrice')) apply('Exclude club price', (p) => !/klubpris/i.test(p.salesPoint ?? ''));
  if (on('noPurchaseLimit')) apply('Exclude purchase limits', (p) => !/maks/i.test(p.salesPoint ?? ''));

  const survived = new Set(pool.map((p) => p.sku));
  const lastSurvivors = previous
    .slice()
    .sort((a, b) => b.price - a.price)
    .slice(0, 14)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      price: p.price,
      stockBand: p.stockBand,
      dropped: !survived.has(p.sku),
    }));

  return {
    seed: { sku: seed.sku, name: seed.name, price: seed.price, tier: seed.tier, stockBand: seed.stockBand },
    funnel,
    lastSurvivors,
    left: pool.length,
  };
}

/** The prompt column 2 produces, which is what the model actually receives. */
export function choosePrompt(rules: RuleSet): string {
  return rules.choose
    .filter((c) => c.enabled)
    .map((c) => c.sentence)
    .join('\n\n');
}
