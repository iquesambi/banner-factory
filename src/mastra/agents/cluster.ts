/**
 * Who the customer probably is, inferred from the one thing we know: the
 * product they were looking at.
 *
 * This only runs when the seed is IN STOCK. There is nothing to substitute,
 * so the banner is a suggestion, and a suggestion needs a reading of the
 * person. With an out-of-stock seed the job is to replace a specific thing,
 * and that needs no theory about who they are.
 *
 * Four clusters, each grounded in brands this catalogue actually carries —
 * the counts below were measured, not assumed, so the classifier is choosing
 * between groups that exist rather than between ideas.
 */
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { TaggedProduct } from '../../types.js';

export const CLUSTER_MODEL =
  process.env.CLUSTER_MODEL ?? process.env.TAGGER_MODEL ?? 'gemini-3.5-flash-lite';

export const CLUSTER_FALLBACK_MODEL = process.env.CLUSTER_FALLBACK_MODEL ?? '';

export const CLUSTERS = ['tech', 'design', 'nordic', 'value'] as const;
export type Cluster = (typeof CLUSTERS)[number];

export const CLUSTER_LABEL: Record<Cluster, string> = {
  tech: 'Technology enthusiast',
  design: 'Design-led buyer',
  nordic: 'Nordic traditional',
  value: 'Practical value',
};

/**
 * What each cluster buys, and what the banner should then offer it.
 *
 * The fourth is mine. The brief's own design references name four customer
 * segments, and the three given here cover the first three; what is missing
 * is the one that buys on function and price — the first flat, the
 * replacement that just has to work. This catalogue supports it plainly:
 * Elkjøp's own brands are 397 products (Sandstrøm 204, Logik 119, Goji 50,
 * Essentials 24), and nobody buys those for the badge.
 */
export const CLUSTER_NOTE: Record<Cluster, string> = {
  tech: 'Buys on capability and specification. Graphics cards, VR headsets, gaming peripherals, high refresh screens. Asus, Corsair, SteelSeries, Razer, MSI, Gigabyte. Offer more capability, not a prettier object.',
  design: 'Buys on how the object looks and which name is on it. New iPhones, Smeg, Miele, Bosch, Dyson, KitchenAid, Sonos. Offer the object that carries the room, not the extra feature.',
  nordic: 'Buys the established Nordic names, quietly. Electrolux, AEG, Asko, Grohe, Epoq, Jabra, Nilfisk. Offer durability and the familiar maker, not novelty.',
  value: 'Buys on function and price. Own brands and entry models: Sandstrøm, Logik, Goji, Essentials. Offer the thing that does the job for less, and never imply a compromise they did not ask about.',
};

const CLUSTER_INSTRUCTIONS = `You read one product and say what kind of shopper was looking at it.

This is a retargeting banner for a Nordic electronics and appliance retailer.
The customer looked at this product and it is in stock, so nothing needs
replacing. The banner will suggest something else, and what to suggest
depends on why they were looking.

The four readings:

tech — buys on capability and specification. Graphics cards, VR headsets,
gaming peripherals, high refresh screens, components. Brands like Asus,
Corsair, SteelSeries, Razer, MSI, Gigabyte.

design — buys on how the object looks and whose name is on it. New iPhones,
Smeg, Miele, Bosch, Dyson, KitchenAid, Sonos. The object is furniture as much
as it is a machine.

nordic — buys the established Nordic makers, quietly and for the long run.
Electrolux, AEG, Asko, Grohe, Epoq, Jabra, Nilfisk.

value — buys on function and price. Own brands and entry models: Sandstrøm,
Logik, Goji, Essentials. A first flat, or a replacement that simply has to
work.

HOW TO READ

The brand is the strongest signal, then the category, then what the name
spells out about the model. A premium brand in a plain category still reads
as that brand's kind of buyer.

Do not use price alone. An expensive product is not automatically design and
a cheap one is not automatically value — a cheap graphics card is still tech,
and an expensive Electrolux oven is still nordic.

When two readings fit, pick the one the BRAND supports, and say in your
reason which other one you considered. A Samsung television could be design
or value; the model line decides it.

Answer with one of: tech, design, nordic, value. Then one short sentence
saying what in the product made you choose it. Then a confidence: high when
the brand and the category agree, low when you are leaning on one of them.`;

export const clusterSchema = z.object({
  cluster: z.enum(CLUSTERS),
  reason: z.string(),
  confidence: z.enum(['high', 'low']),
});

export type ClusterAnswer = z.infer<typeof clusterSchema>;

export const clusterClassifier = new Agent({
  id: 'cluster-classifier',
  name: 'cluster-classifier',
  instructions: CLUSTER_INSTRUCTIONS,
  model: google(CLUSTER_MODEL),
});

export const clusterClassifierFallback = CLUSTER_FALLBACK_MODEL
  ? new Agent({
      id: 'cluster-classifier-fallback',
      name: 'cluster-classifier-fallback',
      instructions: CLUSTER_INSTRUCTIONS,
      model: google(CLUSTER_FALLBACK_MODEL),
    })
  : null;

export function clusterPrompt(seed: TaggedProduct): string {
  const lines = [
    `Product: ${seed.name}`,
    seed.brand ? `Brand: ${seed.brand}` : null,
    seed.category ? `Category: ${seed.category}` : null,
    `Price: ${seed.price} kr`,
    '',
    'Which of the four is this shopper?',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/**
 * A deterministic reading from the brand alone.
 *
 * Not a replacement for the model — it knows only the brands on this list —
 * but it is free, and where it is confident the model has nothing to add. It
 * also gives the classifier something to be checked against.
 */
const BRAND_CLUSTER: Record<string, Cluster> = {
  asus: 'tech', corsair: 'tech', steelseries: 'tech', razer: 'tech', msi: 'tech',
  gigabyte: 'tech', nvidia: 'tech', meta: 'tech', valve: 'tech',
  apple: 'design', smeg: 'design', miele: 'design', dyson: 'design',
  kitchenaid: 'design', sonos: 'design', marshall: 'design',
  electrolux: 'nordic', aeg: 'nordic', asko: 'nordic', grohe: 'nordic',
  epoq: 'nordic', jabra: 'nordic', nilfisk: 'nordic', gorenje: 'nordic',
  sandstrom: 'value', logik: 'value', goji: 'value', essentials: 'value',
};

export function clusterFromBrand(seed: TaggedProduct): Cluster | null {
  const brand = seed.brand?.toLowerCase().trim();
  return brand ? BRAND_CLUSTER[brand] ?? null : null;
}
