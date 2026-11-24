import type { TaggedProduct } from '../types.js';

/**
 * How wide to look when the customer's product is in stock.
 *
 * With an out-of-stock seed the job is substitution, and the same leaf
 * category is right: the customer wanted that thing. With a seed in stock
 * there is nothing to substitute, so the banner is a suggestion — and a
 * suggestion is a different question. Someone looking at a laptop is served by
 * other laptops, but also by a monitor, a keyboard, a printer.
 *
 * The first version of this widened to the seed's PARENT node and refused to
 * go further, because a department felt like the whole floor. Measuring the
 * tree showed that refusal threw away the point. The Chromebook's parent,
 * `computer-kontor/computere`, holds only laptops and desktops; the
 * peripherals, printers and network gear are SIBLINGS of that parent, 2,014
 * products the pool could never see. The reach has to be the department.
 *
 * What made the department dangerous was never its size — it was that a flat
 * sample of it is a random slice with no shape. So the reach widens and the
 * shaping moves to `bandOf`: the pool keeps its distance from the seed, and
 * the shortlist is drawn in bands rather than scooped off the floor.
 */
export interface Neighbourhood {
  /** The widest node the pool is drawn from: the department. */
  root: string;
  /**
   * The node that covers the same KIND of product — the seed's parent, or its
   * own category when the tree is too shallow to have one. Tier is judged
   * inside this and nowhere else, because a premium mouse and a premium laptop
   * are not on one scale.
   */
  nearRoot: string;
  products: TaggedProduct[];
}

export function neighbourhood(seed: TaggedProduct, all: TaggedProduct[]): Neighbourhood {
  const category = seed.category;
  if (!category) return { root: '', nearRoot: '', products: [] };

  const segments = category.split('/');
  const root = segments[0]!;
  /**
   * A two-segment category has the department as its parent, so widening
   * "near" to it would make every band the same thing. There, near is the leaf.
   */
  const nearRoot = segments.length >= 3 ? segments.slice(0, -1).join('/') : category;

  const products = all.filter(
    (p) => p.category === root || (p.category?.startsWith(`${root}/`) ?? false),
  );

  return { root, nearRoot, products };
}

/**
 * How far a product sits from the seed, in three steps that mean something
 * different to a shopper.
 *
 *   0  the same thing — another laptop
 *   1  the same kind — a desktop, under the same parent
 *   2  the same department — a monitor, a printer, a mouse
 *
 * Band 2 is where this stopped being a list of near-identical products, and it
 * is also the band tier must not filter, because tier is only meaningful
 * against products of the same kind.
 */
export function bandOf(seedCategory: string, nearRoot: string, category: string | null): 0 | 1 | 2 {
  if (!category) return 2;
  if (category === seedCategory) return 0;
  if (category === nearRoot || category.startsWith(`${nearRoot}/`)) return 1;
  return 2;
}

/**
 * How far a product sits from the seed inside that neighbourhood.
 *
 * 0 is the same leaf, 1 a sibling leaf, 2 a leaf one level deeper. Used to
 * prefer the near over the far when a band has to be cut down.
 */
export function distanceFrom(seedCategory: string, category: string | null): number {
  if (!category) return 99;
  if (category === seedCategory) return 0;
  const a = seedCategory.split('/');
  const b = category.split('/');
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  return Math.max(a.length, b.length) - shared;
}
