/**
 * Shapes shared by the server runner and the screens.
 *
 * They live apart from `jobs.ts` because that module is server-only — it
 * reaches for the filesystem and for Mastra — while the board and the card
 * need the same types in the browser.
 */
import type { ArtDirectorBrief } from '@/src/banner/brief.js';
import type { Language } from '@/src/banner/facts.js';

export const STAGES = ['queued', 'choosing', 'writing', 'drawing', 'review', 'ready', 'failed'] as const;
export type Stage = (typeof STAGES)[number];

/** The columns the board shows, in order. `failed` is a card state, not a column. */
export const BOARD_COLUMNS: ReadonlyArray<{ stage: Stage; title: string; dot: string }> = [
  { stage: 'queued', title: 'Queued', dot: '#cbd5e1' },
  { stage: 'choosing', title: 'Choosing', dot: '#0e2d7c' },
  { stage: 'writing', title: 'Writing', dot: '#0e2d7c' },
  { stage: 'drawing', title: 'Drawing', dot: '#0e2d7c' },
  { stage: 'review', title: 'Review', dot: '#b45309' },
  { stage: 'ready', title: 'Ready', dot: '#4d7d14' },
];

export const LANGUAGE_LABEL: Record<Language, string> = {
  da: 'Dansk',
  sv: 'Svenska',
  en: 'English',
};

export interface JobEvent {
  seq: number;
  stage: string;
  elapsedMs: number;
  data: Record<string, unknown>;
}

export interface JobCost {
  calls: number;
  tokens: number;
  avoided: number;
  /** Null until a rate exists for every model used, never a guess. */
  usd: number | null;
  /** The day the price table was read, shown so the figure can be doubted. */
  rateReadAt: string | null;
  byStep: Array<{ name: string; calls: number; tokens: number; usd: number | null }>;
}

export interface Job {
  id: string;
  createdAt: string;
  stage: Stage;
  language: Language;
  seed: { sku: string; name: string; price: number; stockBand: string; image: string | null };
  pick: { sku: string; name: string; price: number; reason: string; image: string | null } | null;
  brief: ArtDirectorBrief | null;
  headlineLines: string[];
  events: JobEvent[];
  cost: JobCost;
  /** File name under .cache/banners, served through /api/banners. */
  png: string | null;
  error: string | null;
  rating: 'up' | 'down' | null;
  ratingReason: string | null;
  /** Set when this job used a banner that already existed instead of making one. */
  reuse: {
    fromJobId: string;
    how: 'seed' | 'pick';
    /** Where the product sat in the matcher's list. Null for a seed hit. */
    rank: number | null;
    /** What the person reading the board needs to understand the swap. */
    note: string;
  } | null;
  /** Why a reuse did NOT happen, when one was looked for and rejected. */
  reuseRejected: string[];
  /** The person asked for a fresh banner on this one. */
  reuseOptOut: boolean;
}

export const DISLIKE_REASONS = [
  'Wrong product',
  'Copy is off',
  'Layout',
  'A number looks wrong',
  'Off brand',
] as const;

export function kr(n: number): string {
  return `${n.toLocaleString('da-DK')} kr`;
}

export function stockLabel(band: string): string {
  const b = band.trim();
  if (!b || b === '0') return 'out of stock';
  return `${b} in stock`;
}
