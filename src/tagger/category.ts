import type { Taxonomy } from '../taxonomy/index.js';
import { fold, words as tokenize } from './normalize.js';

export type MatchKind = 'synonym' | 'phrase' | 'exact' | 'compound';

export interface CategoryTerm {
  term: string;
  termWords: string[];
  paths: string[];
  df: number;
  idf: number;
}

export interface CategoryGuess {
  path: string;
  score: number;
  kind: MatchKind;
  term: string;
  /** Score gap to the runner-up. A small gap means genuinely ambiguous. */
  margin: number;
  /** Ranked alternatives, handed to the LLM validator as a closed choice set. */
  candidates: string[];
}

/**
 * Terms that match a large share of the catalogue cannot be category markers.
 * This replaces a hand-written stopword list: "smart" is dropped because the
 * data says it is everywhere, not because someone remembered to blocklist it.
 */
const MAX_DF_RATIO = 0.15;
const MIN_COMPOUND_LEN = 4;

const KIND_WEIGHT: Record<MatchKind, number> = {
  // A curated synonym is a human decision about an important category and
  // outranks anything inferred from the slug text.
  synonym: 100,
  phrase: 3.0,
  exact: 2.0,
  compound: 1.3,
};

/** Danish prepositions and conjunctions that split a slug into head + qualifier. */
const PREPOSITIONS = new Set(['til', 'og', 'for', 'med', 'uden', 'af', 'i', 'pa']);

/**
 * The word in a multi-word slug that names the product type.
 *
 * Within a single glued word Danish is head-FINAL (netvaerks|switch -> switch),
 * but across words a prepositional phrase qualifies rightward, so the type sits
 * before the preposition: `vagbeslag til tv` is a bracket, not a television,
 * and `gaming controllere til pc og smartphone` is a controller, not a phone.
 */
function typeHead(slugWords: string[]): string | null {
  const cut = slugWords.findIndex((w) => PREPOSITIONS.has(w));
  const stem = cut > 0 ? slugWords.slice(0, cut) : slugWords;
  return stem.at(-1) ?? null;
}

export class CategoryTagger {
  private terms = new Map<string, CategoryTerm>();
  private multiWord: CategoryTerm[] = [];
  private docCount = 0;
  private fitted = false;

  constructor(private taxonomy: Taxonomy) {
    for (const cat of taxonomy.categories) {
      const tw = tokenize(cat.slug.replace(/-/g, ' '));
      if (!tw.length) continue;

      // The full slug as a phrase is always the strongest, least ambiguous signal.
      this.register(tw.join(' '), tw, cat.path);
      if (tw.length === 1) continue;

      const parentSlug = cat.path.split('/').at(-2);
      const parentWords = parentSlug ? tokenize(parentSlug.replace(/-/g, ' ')) : [];

      // A child whose slug opens with the same word as its parent's is a
      // qualified variant of that parent, so the rest of its slug is a theme or
      // a brand, not a product type. `lego/lego-pokemon` is LEGO themed on
      // Pokemon; `lego-tilbehor-og-merch/lego-krus` is a LEGO mug. Registering
      // "pokemon" or "krus" from those would pull every Pokemon lamp and every
      // mug in the catalogue into the LEGO branch. The parent already carries
      // the real type word, so these nodes contribute only their full phrase.
      if (parentWords.length && parentWords[0] === tw[0]) continue;

      const head = typeHead(tw);
      if (head && head.length >= 2) this.register(head, [head], cat.path);
    }
  }

  private register(term: string, termWords: string[], path: string) {
    const existing = this.terms.get(term);
    if (existing) {
      if (!existing.paths.includes(path)) existing.paths.push(path);
      return;
    }
    this.terms.set(term, { term, termWords, paths: [path], df: 0, idf: 0 });
  }

  /**
   * One deterministic pass over the catalogue to learn how discriminating each
   * term is. No model, no network — this is why tagging the base costs nothing.
   */
  fit(names: string[]): this {
    this.docCount = names.length;
    for (const t of this.terms.values()) t.df = 0;

    for (const name of names) {
      for (const term of this.rawMatches(name)) term.df++;
    }

    for (const t of this.terms.values()) {
      t.idf = t.df > 0 ? Math.log(this.docCount / t.df) : 0;
    }
    this.multiWord = [...this.terms.values()].filter((t) => t.termWords.length > 1);
    this.fitted = true;
    return this;
  }

  /** Every term the name touches, ignoring weights. Used by fit() and tag(). */
  private rawMatches(name: string): Set<CategoryTerm> {
    const found = new Set<CategoryTerm>();
    const ws = tokenize(name);
    if (!ws.length) return found;
    const wordSet = new Set(ws);

    for (const w of ws) {
      const exact = this.terms.get(w);
      if (exact) found.add(exact);
      // Danish compounds are head-final: netvaerks|switch, toerre|tumbler.
      for (let cut = 1; cut <= w.length - MIN_COMPOUND_LEN; cut++) {
        const suffix = w.slice(cut);
        const hit = this.terms.get(suffix);
        if (hit && hit.termWords.length === 1) found.add(hit);
      }
    }

    const padded = ` ${ws.join(' ')} `;
    const pool = this.multiWord.length
      ? this.multiWord
      : [...this.terms.values()].filter((t) => t.termWords.length > 1);
    for (const t of pool) {
      if (!wordSet.has(t.termWords[t.termWords.length - 1]!)) continue;
      if (padded.includes(` ${t.term} `)) found.add(t);
    }
    return found;
  }

  /**
   * First curated entry that matches wins. Order in synonyms.json is the
   * priority, which is why accessories are listed before the devices they are
   * named after.
   */
  private synonymFor(ws: string[]): { path: string; term: string } | null {
    const wordSet = new Set(ws);
    const endsWithAny = (suffixes: string[]) =>
      suffixes.find((suf) => ws.some((w) => w === suf || (w.length > suf.length && w.endsWith(suf))));

    for (const entry of this.taxonomy.synonyms) {
      const hitWord = entry.words?.find((w) => wordSet.has(w));
      const hitSuffix = hitWord ? undefined : endsWithAny(entry.suffixes ?? []);
      const term = hitWord ?? hitSuffix;
      if (!term) continue;

      if (entry.requireAny?.length && !entry.requireAny.some((w) => wordSet.has(w))) continue;
      if (entry.excludeAny?.some((w) => wordSet.has(w))) continue;

      return { path: entry.path, term };
    }
    return null;
  }

  tag(name: string): CategoryGuess | null {
    if (!this.fitted) throw new Error('CategoryTagger.fit() must run before tag()');

    const ws = tokenize(name);
    if (!ws.length) return null;
    const wordSet = new Set(ws);
    const padded = ` ${ws.join(' ')} `;
    const maxDf = this.docCount * MAX_DF_RATIO;

    const scored: Array<{ path: string; score: number; kind: MatchKind; term: string }> = [];

    const synonym = this.synonymFor(ws);
    if (synonym) {
      scored.push({
        path: synonym.path,
        score: KIND_WEIGHT.synonym,
        kind: 'synonym',
        term: synonym.term,
      });
    }

    const push = (t: CategoryTerm, kind: MatchKind, position: number) => {
      if (t.df > maxDf || t.idf <= 0) return;
      const positionBonus = ws.length > 1 ? 1 + 0.3 * (position / (ws.length - 1)) : 1;
      // A term pointing at many nodes carries less information about which one.
      const ambiguity = Math.sqrt(t.paths.length);
      const score = (t.idf * KIND_WEIGHT[kind] * positionBonus) / ambiguity;
      for (const path of this.rankPaths(t)) {
        scored.push({ path, score, kind, term: t.term });
      }
    };

    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      const exact = this.terms.get(w);
      if (exact) push(exact, 'exact', i);
      for (let cut = 1; cut <= w.length - MIN_COMPOUND_LEN; cut++) {
        const hit = this.terms.get(w.slice(cut));
        if (hit && hit.termWords.length === 1) push(hit, 'compound', i);
      }
    }

    for (const t of this.multiWord) {
      if (!wordSet.has(t.termWords[t.termWords.length - 1]!)) continue;
      const at = padded.indexOf(` ${t.term} `);
      if (at < 0) continue;
      const position = padded.slice(0, at + 1).split(' ').length - 1;
      push(t, 'phrase', Math.min(position, ws.length - 1));
    }

    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0]!;
    const candidates: string[] = [];
    for (const s of scored) {
      if (!candidates.includes(s.path)) candidates.push(s.path);
      if (candidates.length === 5) break;
    }
    const runnerUp = scored.find((s) => s.path !== best.path);

    return {
      path: best.path,
      score: Number(best.score.toFixed(4)),
      kind: best.kind,
      term: best.term,
      margin: Number((best.score - (runnerUp?.score ?? 0)).toFixed(4)),
      candidates,
    };
  }

  /** Prefer the node the term names exactly, then the most specific one. */
  private rankPaths(t: CategoryTerm): string[] {
    return [...t.paths].sort((a, b) => {
      const aLeaf = a.slice(a.lastIndexOf('/') + 1).replace(/-/g, ' ') === t.term ? 0 : 1;
      const bLeaf = b.slice(b.lastIndexOf('/') + 1).replace(/-/g, ' ') === t.term ? 0 : 1;
      if (aLeaf !== bLeaf) return aLeaf - bLeaf;
      return b.split('/').length - a.split('/').length;
    });
  }

  stats() {
    const live = [...this.terms.values()].filter(
      (t) => t.df > 0 && t.df <= this.docCount * MAX_DF_RATIO,
    );
    const dropped = [...this.terms.values()]
      .filter((t) => t.df > this.docCount * MAX_DF_RATIO)
      .sort((a, b) => b.df - a.df);
    return {
      terms: this.terms.size,
      discriminating: live.length,
      droppedAsTooCommon: dropped.map((t) => ({ term: t.term, df: t.df })),
    };
  }
}

export function brandFromName(name: string, taxonomy: Taxonomy): string | null {
  const ws = tokenize(name);
  // Longest n-gram wins; brands sit at the front of these names, so ties go left.
  for (const size of [4, 3, 2, 1]) {
    for (let i = 0; i + size <= ws.length; i++) {
      const candidate = ws.slice(i, i + size).join(' ');
      if (candidate.length < 3) continue;
      if (taxonomy.brandSet.has(candidate)) return candidate;
    }
  }
  return null;
}

export { fold };
