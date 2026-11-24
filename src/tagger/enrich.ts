import type { Taxonomy } from '../taxonomy/index.js';
import type { TaggedProduct } from '../types.js';
import type { TagStore } from '../store/index.js';
import { CategoryTagger } from './category.js';
import { CostMeter, readUsage } from '../cost/index.js';
import { RpmThrottle, withRetry } from '../mastra/rpm.js';
import { publishProducts } from '../store/firestore-products.js';
import {
  ENRICH_BATCH, ENRICHER_FALLBACK_MODEL, ENRICHER_MODEL, LETTERS,
  askPrompt, askSchema, categoryAsker, categoryAskerFallback,
  categoryChooser, categoryChooserFallback, categoryConfirmer, categoryConfirmerFallback,
  choosePrompt, chooseSchema, confirmPrompt, confirmSchema,
} from '../mastra/agents/category-enricher.js';

/**
 * Giving every product a category, cheaply, by asking only where asking helps.
 *
 * The rules already settle 45% of the catalogue on a whole word with nothing
 * tying against it, and those cost nothing. This fills in the rest in three
 * passes, each a different question:
 *
 *   confirm  the rule guessed by splitting a glued word, or broke a tie.
 *            One yes-or-no.
 *   choose   the confirmation said no. The alternatives the rules already
 *            ranked are offered as a closed list, with "none of these" as a
 *            real answer.
 *   ask      no rule matched at all. The model says what the thing IS in plain
 *            Danish, and that phrase goes back through the deterministic
 *            matcher. The model supplies the word; the taxonomy still decides
 *            the path, so a category it invented cannot be stored.
 *
 * Everything is batched and written through after each batch, so a run that
 * is interrupted keeps what it paid for and the next one resumes.
 */

export type Pass = 'confirm' | 'choose' | 'ask';

/**
 * Products per Firestore round trip while mirroring.
 *
 * Firestore's own batch limit is 500 writes; this stays under it and keeps
 * each round trip short enough that an interrupted run loses at most this
 * many publications rather than the whole catalogue's worth.
 */
const PUBLISH_CHUNK = 400;

export interface EnrichOptions {
  passes?: Pass[];
  /** Most products to touch, across all passes. */
  limit?: number;
  /** Re-ask products a model has already decided. */
  redo?: boolean;
  batch?: number;
  /** Bucket and report without calling anything. */
  dryRun?: boolean;
  /**
   * Mirror each batch to Firestore as it is decided, rather than dumping the
   * catalogue at the end. A batch that was paid for is published the moment
   * it exists, so an interrupted run leaves the work it did behind instead of
   * losing the publication of all of it.
   */
  publish?: boolean;
  onProgress?: (note: string) => void;
}

export interface EnrichReport {
  buckets: { perfect: number; imperfect: number; none: number };
  confirmed: number;
  rejected: number;
  chosen: number;
  stillNone: number;
  asked: number;
  resolvedByAsking: number;
  unresolvedAfterAsking: number;
  /** Documents mirrored to Firestore while the run went. */
  published: number;
  /** Why publishing did not happen, when it did not. */
  publishSkipped: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number | null;
  /** What the model said for products the taxonomy still could not place. */
  unmatchedAnswers: Array<{ sku: string; name: string; answer: string }>;
}

interface Bucketed {
  perfect: TaggedProduct[];
  imperfect: Array<{ product: TaggedProduct; proposed: string; options: string[] }>;
  none: TaggedProduct[];
}

/** Products a model has already judged are left alone unless asked for again. */
function alreadyAsked(p: TaggedProduct): boolean {
  return p.categoryDecidedBy === 'confirmed'
    || p.categoryDecidedBy === 'corrected'
    || p.categoryDecidedBy === 'asked';
}

export function bucket(products: TaggedProduct[], tagger: CategoryTagger, redo = false): Bucketed {
  const out: Bucketed = { perfect: [], imperfect: [], none: [] };
  for (const p of products) {
    if (!redo && alreadyAsked(p)) continue;
    const guess = tagger.tag(p.name);
    if (!guess) { out.none.push(p); continue; }
    if (guess.perfect) { out.perfect.push(p); continue; }
    out.imperfect.push({
      product: p,
      proposed: guess.path,
      // The proposal itself is dropped from the alternatives: it was just
      // rejected, so offering it again is noise in a short list.
      options: guess.candidates.filter((c) => c !== guess.path).slice(0, LETTERS.length),
    });
  }
  return out;
}

async function callBatch<T>(
  meter: CostMeter,
  stage: string,
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | null,
): Promise<T> {
  const began = Date.now();
  try {
    const result = await withRetry(primary, { onRetry: () => {} });
    meter.record(stage, ENRICHER_MODEL, await readUsage(result), Date.now() - began);
    return result;
  } catch (error) {
    if (!fallback) throw error;
    const result = await withRetry(fallback, { onRetry: () => {} });
    meter.record(stage, ENRICHER_FALLBACK_MODEL, await readUsage(result), Date.now() - began);
    return result;
  }
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function enrichCategories(
  store: TagStore,
  taxonomy: Taxonomy,
  options: EnrichOptions = {},
): Promise<EnrichReport> {
  const {
    /**
     * Only the open question runs in bulk.
     *
     * A product with no category at all blocks everything: it cannot be a
     * seed, it cannot be in a pool, and no later step can rescue it. Those are
     * worth paying for up front.
     *
     * A product the rules placed imperfectly is a different case. It has a
     * working category already, and the question is only whether to keep it —
     * so it is asked when that category is actually touched by a run, in
     * `validate-products`. Most categories are never touched, and confirming
     * 3,881 products in advance would mostly buy answers nobody reads.
     */
    passes = ['ask'],
    limit, redo = false, batch = ENRICH_BATCH, dryRun = false, publish = true,
    onProgress = () => {},
  } = options;

  const all = store.all();
  const tagger = new CategoryTagger(taxonomy).fit(all.map((p) => p.name));
  const buckets = bucket(all, tagger, redo);

  const report: EnrichReport = {
    buckets: {
      perfect: buckets.perfect.length,
      imperfect: buckets.imperfect.length,
      none: buckets.none.length,
    },
    confirmed: 0, rejected: 0, chosen: 0, stillNone: 0,
    asked: 0, resolvedByAsking: 0, unresolvedAfterAsking: 0,
    published: 0, publishSkipped: null,
    calls: 0, inputTokens: 0, outputTokens: 0, usd: null,
    unmatchedAnswers: [],
  };
  if (dryRun) return report;

  // Local bindings: an imported `const` is not narrowed inside a closure, and
  // these are all read inside one.
  const confirmFb = categoryConfirmerFallback;
  const chooseFb = categoryChooserFallback;
  const askFb = categoryAskerFallback;

  /**
   * One batch up, as soon as it is settled.
   *
   * Reported, never thrown: the categories are already in the local store,
   * which is what every CLI reads, and a mirror that cannot be written is a
   * missing copy rather than a failed tagging run.
   */
  const mirror = async (skus: string[]) => {
    if (!publish || !skus.length) return;
    const out = await publishProducts(store, { only: skus });
    report.published += out.written;
    if (out.unavailable && !report.publishSkipped) report.publishSkipped = out.unavailable;
  };

  const meter = new CostMeter();
  const throttle = new RpmThrottle();
  const stamp = new Date().toISOString();
  let touched = 0;
  const room = () => (limit === undefined ? Infinity : Math.max(0, limit - touched));

  /**
   * A perfect fit is recorded as a decision, not left blank. Otherwise the
   * next run cannot tell "the rules were sure" from "nobody has looked yet".
   */
  const record = (p: TaggedProduct, guess: ReturnType<CategoryTagger['tag']>) => {
    if (!guess) return;
    p.category = guess.path;
    p.categoryScore = guess.score;
    p.categoryMargin = guess.margin;
    p.categoryMethod = guess.kind;
    p.categoryCandidates = guess.candidates;
    p.categoryDecidedBy = 'rule';
    p.categoryPerfect = guess.perfect;
    p.autoCategory = guess.path;
    if (p.status === 'unresolved') p.status = 'auto';
    store.put(p);
  };

  /**
   * Free, and the step that makes the lazy confirmation possible.
   *
   * Every product the rules place gets its verdict written down, perfect or
   * not. Without the flag, nothing downstream can tell "the rules were sure"
   * from "the rules guessed", and the on-demand validator would have to ask
   * about all of them — which is the bill this whole design exists to avoid.
   */
  const recorded: string[] = [];
  for (const p of buckets.perfect) {
    if (p.categoryPerfect === true && p.categoryDecidedBy === 'rule') continue;
    record(p, tagger.tag(p.name));
    recorded.push(p.sku);
  }
  for (const { product, proposed } of buckets.imperfect) {
    if (product.categoryPerfect === false && product.category === proposed) continue;
    record(product, tagger.tag(product.name));
    recorded.push(product.sku);
  }

  /**
   * These go up in chunks as they are settled, not in one dump at the end.
   *
   * Only the ones whose verdict actually CHANGED are in this list — a second
   * run over an unchanged catalogue publishes nothing at all, because the two
   * loops above skip products that already say what the rules would say.
   */
  for (let start = 0; start < recorded.length; start += PUBLISH_CHUNK) {
    await mirror(recorded.slice(start, start + PUBLISH_CHUNK));
    if (recorded.length > PUBLISH_CHUNK) {
      onProgress(`regras · ${report.published}/${recorded.length} publicados`);
    }
  }

  // ------------------------------------------------------------- confirm
  const rejected: Array<{ product: TaggedProduct; options: string[] }> = [];
  if (passes.includes('confirm')) {
    const todo = buckets.imperfect.slice(0, room());
    for (const group of chunk(todo, batch)) {
      await throttle.take();
      const items = group.map((g) => ({ name: g.product.name, proposed: g.proposed }));
      const result = await callBatch(
        meter, 'confirm',
        () => categoryConfirmer.generate(confirmPrompt(items), {
          structuredOutput: { schema: confirmSchema },
        }),
        confirmFb
          ? () => confirmFb.generate(confirmPrompt(items), {
              structuredOutput: { schema: confirmSchema },
            })
          : null,
      );

      const seen = new Set<number>();
      for (const a of result.object?.answers ?? []) {
        const i = a.item - 1;
        const entry = group[i];
        // An index outside the batch is the one failure this format allows.
        if (!entry || seen.has(i)) continue;
        seen.add(i);
        const p = entry.product;
        if (a.belongs) {
          p.category = entry.proposed;
          p.autoCategory = entry.proposed;
          p.categoryDecidedBy = 'confirmed';
          p.status = 'validated';
          p.validatedAt = stamp;
          p.validatedBy = ENRICHER_MODEL;
          p.validationNote = 'A rule guessed it and the model agreed.';
          report.confirmed++;
          store.put(p);
        } else {
          report.rejected++;
          rejected.push({ product: p, options: entry.options });
        }
      }
      await mirror(group.map((g) => g.product.sku));
      touched += group.length;
      onProgress(`confirm · ${report.confirmed} yes · ${report.rejected} no · ${report.published} publicados`);
    }
  }

  // -------------------------------------------------------------- choose
  if (passes.includes('choose') && rejected.length) {
    const withOptions = rejected.filter((r) => r.options.length);
    /** Rejected with no alternatives left: the rules had nothing else to offer. */
    for (const r of rejected.filter((x) => !x.options.length)) {
      r.product.category = null;
      r.product.categoryDecidedBy = 'corrected';
      r.product.status = 'unresolved';
      r.product.validationNote = 'The rule was wrong and the rules had no other option.';
      report.stillNone++;
      store.put(r.product);
    }

    for (const group of chunk(withOptions, batch)) {
      await throttle.take();
      const items = group.map((g) => ({ name: g.product.name, options: g.options }));
      const result = await callBatch(
        meter, 'choose',
        () => categoryChooser.generate(choosePrompt(items), {
          structuredOutput: { schema: chooseSchema },
        }),
        chooseFb
          ? () => chooseFb.generate(choosePrompt(items), {
              structuredOutput: { schema: chooseSchema },
            })
          : null,
      );

      const seen = new Set<number>();
      for (const a of result.object?.answers ?? []) {
        const i = a.item - 1;
        const entry = group[i];
        if (!entry || seen.has(i)) continue;
        seen.add(i);
        const p = entry.product;
        const letter = (a.option ?? '').trim().toLowerCase().slice(0, 1);
        const at = LETTERS.indexOf(letter);
        const picked = at >= 0 ? entry.options[at] : undefined;

        if (!picked) {
          // "x", or a letter outside the list, which is the same answer: none.
          p.category = null;
          p.categoryDecidedBy = 'corrected';
          p.status = 'unresolved';
          p.validationNote = 'The model rejected every category the rules offered.';
          report.stillNone++;
        } else {
          p.category = picked;
          p.categoryDecidedBy = 'corrected';
          p.categoryMethod = 'llm';
          p.status = 'corrected';
          p.validatedAt = stamp;
          p.validatedBy = ENRICHER_MODEL;
          p.validationNote = 'The rule was wrong; the model picked from the alternatives.';
          report.chosen++;
        }
        store.put(p);
      }
      await mirror(group.map((g) => g.product.sku));
      onProgress(`choose · ${report.chosen} corrected · ${report.stillNone} left with none · ${report.published} publicados`);
    }
  }

  // ----------------------------------------------------------------- ask
  if (passes.includes('ask')) {
    const todo = buckets.none.slice(0, room());
    for (const group of chunk(todo, batch)) {
      await throttle.take();
      const names = group.map((p) => p.name);
      const result = await callBatch(
        meter, 'ask',
        () => categoryAsker.generate(askPrompt(names), {
          structuredOutput: { schema: askSchema },
        }),
        askFb
          ? () => askFb.generate(askPrompt(names), {
              structuredOutput: { schema: askSchema },
            })
          : null,
      );

      const seen = new Set<number>();
      for (const a of result.object?.answers ?? []) {
        const i = a.item - 1;
        const p = group[i];
        if (!p || seen.has(i)) continue;
        seen.add(i);
        report.asked++;

        const answer = (a.type ?? '').trim();
        p.categoryAnswer = answer || null;
        p.categoryDecidedBy = 'asked';
        p.validatedAt = stamp;
        p.validatedBy = ENRICHER_MODEL;

        /**
         * The cleaning step. The model gave a product type in words; the
         * matcher turns words into a path, exactly as it does for a product
         * name. So the model never names a category, and anything it says
         * that the taxonomy does not recognise simply does not land.
         */
        const guess = answer ? tagger.matchType(answer) : null;
        if (guess) {
          p.category = guess.path;
          p.categoryScore = guess.score;
          p.categoryMargin = guess.margin;
          p.categoryMethod = 'llm';
          p.categoryCandidates = guess.candidates;
          p.status = 'corrected';
          p.validationNote = `No rule matched the name; the model called it "${answer}".`;
          report.resolvedByAsking++;
        } else {
          p.status = 'unresolved';
          p.validationNote = answer
            ? `The model called it "${answer}", which matches nothing in the taxonomy.`
            : 'The model could not tell what the product is from its name.';
          report.unresolvedAfterAsking++;
          if (answer && report.unmatchedAnswers.length < 40) {
            report.unmatchedAnswers.push({ sku: p.sku, name: p.name, answer });
          }
        }
        store.put(p);
      }
      await mirror(group.map((p) => p.sku));
      touched += group.length;
      onProgress(`ask · ${report.resolvedByAsking} placed · ${report.unresolvedAfterAsking} still none · ${report.published} publicados`);
    }
  }

  const cost = meter.summary();
  report.calls = cost.calls;
  report.inputTokens = cost.inputTokens;
  report.outputTokens = cost.outputTokens;
  report.usd = cost.usd;
  return report;
}
