import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export interface CategoryNode {
  slug: string;
  path: string;
  children?: CategoryNode[];
}

export interface FlatCategory {
  slug: string;
  path: string;
  depth: number;
  department: string;
  isLeaf: boolean;
}

/**
 * A curated bridge from the words the feed uses to a taxonomy path. Hand-kept
 * on purpose: the categories that matter most for a banner (phones above all)
 * cannot be reached by string matching, because the feed writes "smartphone"
 * and the taxonomy says "mobiltelefon".
 */
export interface SynonymEntry {
  path: string;
  why: string;
  /** Matches when the product name contains this exact word. */
  words?: string[];
  /** Matches when a word in the name ends with this (Danish compound tail). */
  suffixes?: string[];
  /** At least one of these must also appear, e.g. a tablet case needs "tablet". */
  requireAny?: string[];
  /** None of these may appear — keeps a phone case out of the phone category. */
  excludeAny?: string[];
}

export interface Taxonomy {
  /** Hash of the source files — bump invalidates every validation flag. */
  version: string;
  categories: FlatCategory[];
  byPath: Map<string, FlatCategory>;
  brands: string[];
  brandSet: Set<string>;
  /** Evaluated in file order: the first entry that matches wins. */
  synonyms: SynonymEntry[];
}

const TAXONOMY_DIR = 'data/taxonomy';

export function loadTaxonomy(dir = TAXONOMY_DIR): Taxonomy {
  const catRaw = readFileSync(`${dir}/categories.json`, 'utf8');
  const brandRaw = readFileSync(`${dir}/brands.json`, 'utf8');
  const synRaw = readFileSync(`${dir}/synonyms.json`, 'utf8');

  // Synonyms are part of the taxonomy: editing them must invalidate the
  // validation flags of products that were tagged under the old table.
  const version = createHash('sha256')
    .update(catRaw)
    .update(brandRaw)
    .update(synRaw)
    .digest('hex')
    .slice(0, 12);

  const tree = JSON.parse(catRaw).tree as CategoryNode[];
  const categories: FlatCategory[] = [];

  const walk = (nodes: CategoryNode[], trail: string[]) => {
    for (const node of nodes) {
      const path = [...trail, node.slug];
      categories.push({
        slug: node.slug,
        path: path.join('/'),
        depth: path.length,
        department: path[0]!,
        isLeaf: !node.children?.length,
      });
      if (node.children?.length) walk(node.children, path);
    }
  };
  walk(tree, []);

  const brands = JSON.parse(brandRaw).brands as string[];
  const synonyms = JSON.parse(synRaw).entries as SynonymEntry[];

  const byPath = new Map(categories.map((c) => [c.path, c]));

  // A hand-maintained file drifts the moment the taxonomy is re-fetched, and a
  // silent miss would route products into a category that no longer exists.
  const unknown = synonyms.filter((e) => !byPath.has(e.path));
  if (unknown.length) {
    throw new Error(
      `synonyms.json points at ${unknown.length} path(s) that are not in categories.json:\n` +
        unknown.map((e) => `  ${e.path}`).join('\n'),
    );
  }

  return {
    version,
    categories,
    byPath,
    brands,
    brandSet: new Set(brands.map((b) => b.replace(/-/g, ' '))),
    synonyms,
  };
}

