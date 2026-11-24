import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { loadTaxonomy } from '../../taxonomy/index.js';
import { TagStore } from '../../store/index.js';
import type { TaggedProduct, Tier } from '../../types.js';
import { CostMeter, readUsage } from '../../cost/index.js';
import { RunEvents } from '../../events/index.js';
import { bannerLogger } from '../logger.js';
import { findExactVariant, inStock, type VariantMatch } from '../../recommend/variant.js';
import { RpmThrottle, retryPlanFor, withRetry } from '../rpm.js';
import { hasApiKey } from '../agents/category-validator.js';
import {
  TIER_FALLBACK_MODEL, TIER_MODEL, tierAnswerSchema, tierClassifier,
  tierClassifierFallback, tierPrompt,
} from '../agents/tier-classifier.js';
import {
  RECOMMENDER_FALLBACK_MODEL, RECOMMENDER_MODEL, pickSchema, recommendPrompt,
  recommender, recommenderFallback,
} from '../agents/recommender.js';
import { validateProductsWorkflow } from './validate-products.js';
import { bandOf, neighbourhood } from '../../recommend/tree.js';
import { PROMO_THRESHOLD_PCT, promoShortcut } from '../../recommend/promo.js';
import {
  CATEGORY_PICKER_FALLBACK_MODEL, CATEGORY_PICKER_MODEL, MAX_PICKED_CATEGORIES,
  type CategoryOption,
  categoryPickSchema, categoryPicker, categoryPickerFallback, categoryPickerPrompt,
} from '../agents/category-picker.js';
import {
  CLUSTER_FALLBACK_MODEL, CLUSTER_LABEL, CLUSTER_MODEL, CLUSTER_NOTE,
  clusterClassifier, clusterClassifierFallback, clusterFromBrand, clusterPrompt,
  clusterSchema, type Cluster,
} from '../agents/cluster.js';

/**
 * Products per tier-classification request.
 *
 * Large on purpose. Splitting a category across calls shifts the scale (see
 * tierPrompt), and a single call is also cheaper, because the instructions are
 * sent once instead of once per batch: 98 fridges cost 4,406 input tokens in
 * four calls and about 1,700 in one. Most categories in this catalogue fit
 * under this in a single request.
 */
const TIER_BATCH = 150;
/**
 * Ceiling on how many of a category's products get their category checked on
 * first touch. Cleaning a 251-product category is 26 requests, which is two
 * minutes at the free tier's 15 per minute — too slow to sit in front of a
 * banner. The cap makes the first run bounded; the rest get cleaned by later
 * runs, since every result is persisted.
 */
const POOL_VALIDATION_CAP = 40;
/** Most candidates ever shown to the recommender in one call. */
const CANDIDATE_CEILING = 60;
/**
 * How the shortlist is built when the seed is in stock.
 *
 * The pool is a whole department, so something has to cut it down, and the cut
 * is where the quality of the suggestion is decided. An even sample of the
 * floor would bury the laptops among a thousand cables. These quotas keep the
 * three bands in proportion: mostly the same thing, some of the same kind, and
 * a deliberate slice of the department around it.
 *
 * They add to 140, so the seed and the tier-eligible bands fit in one
 * classification call instead of sixteen.
 */
const SHORTLIST = { same: 50, kind: 20, picked: 70 } as const;
/** Of the candidates shown when suggesting, how many come from band 2. */
const ADJACENT_CANDIDATES = 20;

/**
 * Two jobs share this workflow. With the seed OUT of stock it substitutes:
 * the customer wanted a specific thing and we have to replace it. With the
 * seed IN stock it suggests: nothing needs replacing, so the banner is an
 * offer, and the decisions below are the ways that offer can be reached.
 */
type Mode = 'substitute' | 'suggest';

type Decision =
  | 'promo-seed'
  | 'promo-variant'
  | 'exact-variant'
  | 'model-same-tier'
  | 'model-widened'
  | 'none';

interface RunContext {
  events: RunEvents;
  cost: CostMeter;
  store: TagStore;
  taxonomyVersion: string;
  seed: TaggedProduct;
  mode: Mode;
  /** Which customer the seed suggests. Only read in 'suggest' mode. */
  cluster: Cluster | null;
  clusterBy: 'brand' | 'model' | null;
  /** The node the pool was drawn from: the leaf, or the department when widened. */
  poolRoot: string;
  /** The node holding products of the SAME KIND, which is where tier means something. */
  nearRoot: string;
  /** The sections of the shop the picker chose, in its own order. */
  pickedCategories: Array<{ path: string; reason: string }>;
  /** The picker's one-sentence reading of the customer. */
  profile: string | null;
  pool: TaggedProduct[];
  variant: VariantMatch | null;
  picks: Array<{ product: TaggedProduct; reason: string }>;
  noneReason: string | null;
  counts: Record<string, number>;
  options: {
    storeDir?: string | undefined;
    taxonomyDir?: string | undefined;
    validateSeed: boolean;
    validatePool: boolean;
    forceTier: boolean;
    verbose: boolean;
    webhookUrl?: string | undefined;
  };
}

/**
 * Run-scoped state lives here instead of in the workflow payload: the store is
 * a 19MB object graph and has no business being serialised between steps.
 * Keyed by runId, deleted when the run ends.
 */
const contexts = new Map<string, RunContext>();

function ctx(runId: string): RunContext {
  const c = contexts.get(runId);
  if (!c) throw new Error(`no context for run ${runId}`);
  return c;
}

/**
 * Keeps both ends of the price range when a candidate list is too long.
 *
 * Cutting the cheapest would bury exactly the options worth showing — an
 * equivalent product that costs less is a better recommendation, not a worse
 * one — and cutting by stock depth would drop the scarce flagship that is
 * often the closest match. An even walk along the sorted list keeps the
 * extremes and a representative middle.
 */
function spreadSample<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  const out: T[] = [];
  const step = (list.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(list[Math.round(i * step)]!);
  return [...new Set(out)];
}

/**
 * Where to look for candidates, which is a different question in each mode.
 *
 * Substituting, the same leaf category is right: the customer wanted that
 * thing. Suggesting, the leaf only returns near-identical products they have
 * already seen, so the pool widens to the parent node and everything under it
 * — siblings and their children — with the department guard in `neighbourhood`.
 */
function poolFor(c: RunContext): { products: TaggedProduct[]; root: string; nearRoot: string } {
  if (c.mode === 'substitute') {
    return {
      products: c.store.byCategory(c.seed.category!).filter(inStock),
      root: c.seed.category!,
      nearRoot: c.seed.category!,
    };
  }
  const all = c.store.all();
  const n = neighbourhood(c.seed, all);
  /**
   * Before the picker has spoken, the department is the pool: it is what the
   * free steps need and what the run falls back to with no API key. After it
   * has, the pool is exactly the sections it chose — including, or not
   * including, the one the product itself sits in. Declining to show more of
   * the same thing is a real answer and is left to stand.
   */
  if (!c.pickedCategories.length) {
    return { products: n.products.filter(inStock), root: n.root, nearRoot: n.nearRoot };
  }
  const paths = c.pickedCategories.map((x) => x.path);
  const products = all.filter(
    (p) =>
      p.category !== null &&
      paths.some((k) => p.category === k || p.category!.startsWith(`${k}/`)),
  );
  return { products: products.filter(inStock), root: paths.join(' + '), nearRoot: n.nearRoot };
}

const band = (c: RunContext, p: TaggedProduct) =>
  bandOf(c.seed.category!, c.nearRoot, p.category);

/**
 * Cuts a department-sized pool down to a shortlist that still has a shape.
 *
 * Band 2 is not sampled by price like the others. An even price walk across
 * two thousand accessories returns whatever the department happens to stock
 * most of, which is cables. Instead it goes round-robin across the
 * department's own sections, so the slice holds a monitor AND a printer AND a
 * mouse — different answers rather than forty versions of one.
 */
function shaped(c: RunContext, products: TaggedProduct[]): TaggedProduct[] {
  if (c.mode === 'substitute') return products;
  const byPrice = (a: TaggedProduct, b: TaggedProduct) => b.price - a.price;

  const b0: TaggedProduct[] = [], b1: TaggedProduct[] = [], b2: TaggedProduct[] = [];
  for (const p of products) {
    const n = band(c, p);
    (n === 0 ? b0 : n === 1 ? b1 : b2).push(p);
  }

  /**
   * Everything outside the product's own kind is split by SECTION and each
   * section gets an equal share, spread across its own price range. Sampling
   * that band as one list would hand back whatever the shop stocks most of,
   * which is cables; by section, the shortlist holds a monitor AND a printer
   * AND a bag — different answers instead of forty versions of one.
   */
  const keys = c.pickedCategories.length
    ? c.pickedCategories.map((x) => x.path)
    : [...new Set(b2.map((p) => (p.category ?? '').split('/').slice(0, 2).join('/')))];
  const groups = keys
    .map((k) => b2.filter((p) => p.category === k || p.category!.startsWith(`${k}/`)).sort(byPrice))
    .filter((g) => g.length);
  const per = groups.length ? Math.ceil(SHORTLIST.picked / groups.length) : 0;
  const far = groups.flatMap((g) => spreadSample(g, per));

  return [
    ...new Set([
      ...spreadSample(b0.sort(byPrice), SHORTLIST.same),
      ...spreadSample(b1.sort(byPrice), SHORTLIST.kind),
      ...far.slice(0, SHORTLIST.picked),
    ]),
  ];
}

/**
 * One model call: retried, and if the cheap model is simply unavailable, asked
 * again of a bigger one. Returns which model actually answered so the bill
 * attributes the tokens correctly instead of assuming the cheap rate.
 */
async function callModel<T>(
  c: RunContext,
  stage: string,
  primaryModel: string,
  primary: () => Promise<T>,
  fallbackModel: string,
  fallback: (() => Promise<T>) | null,
): Promise<{ result: T; model: string; ms: number }> {
  const began = Date.now();
  try {
    const result = await withRetry(primary, {
      onRetry: (info) => c.events.emit('model.retry', { stage, model: primaryModel, ...info }),
    });
    return { result, model: primaryModel, ms: Date.now() - began };
  } catch (error) {
    // Only for unavailability. A malformed request or a bad key fails here too,
    // and retrying it on a pricier model would just cost more to fail again.
    if (!fallback || retryPlanFor(error, 0) === null) throw error;
    c.events.emit('model.fallback', {
      stage,
      from: primaryModel,
      to: fallbackModel,
      reason: error instanceof Error ? error.message.slice(0, 100) : String(error).slice(0, 100),
    });
    const result = await withRetry(fallback, {
      onRetry: (info) => c.events.emit('model.retry', { stage, model: fallbackModel, ...info }),
    });
    return { result, model: fallbackModel, ms: Date.now() - began };
  }
}

async function runValidate(input: Record<string, unknown>) {
  const run = await (
    validateProductsWorkflow.createRun as () => Promise<{
      start: (a: unknown) => Promise<{ status: string; result?: unknown; error?: unknown }>;
    }>
  )();
  const out = await run.start({ inputData: input });
  if (out.status !== 'success') {
    throw new Error(`validate-products failed: ${JSON.stringify(out.error ?? out.status)}`);
  }
  return out.result as {
    checked: number; validated: number; corrected: number; filled: number;
    requests: number; usage: { inputTokens: number; outputTokens: number };
  };
}

const stateSchema = z.object({
  runId: z.string(),
  sku: z.string(),
  done: z.boolean(),
  decision: z.string().nullable(),
});
type State = z.infer<typeof stateSchema>;

const pass = (s: State, decision?: Decision): State =>
  decision ? { ...s, done: true, decision } : s;

// ---------------------------------------------------------------- 1. seed
const loadSeed = createStep({
  id: 'load-seed',
  inputSchema: z.object({
    sku: z.string().describe('The product the customer was looking at'),
    storeDir: z.string().optional(),
    taxonomyDir: z.string().optional(),
    validateSeed: z.boolean().default(true),
    validatePool: z.boolean().default(true),
    /** Reclassify tier even where one is already stored. */
    forceTier: z.boolean().default(false),
    verbose: z.boolean().default(false),
    webhookUrl: z.string().optional(),
  }),
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const events = new RunEvents(runId, {
      webhookUrl: inputData.webhookUrl,
      verbose: inputData.verbose,
      logger: bannerLogger,
    });
    events.emit('run.started', { sku: inputData.sku, hasApiKey: hasApiKey() });

    const taxonomy = loadTaxonomy(inputData.taxonomyDir);
    const store = new TagStore(inputData.storeDir).load();
    const seed = store.get(inputData.sku);
    if (!seed) {
      events.emit('run.failed', { reason: 'sku not in store', sku: inputData.sku });
      await events.flush();
      throw new Error(`sku ${inputData.sku} is not in the store`);
    }

    contexts.set(runId, {
      events,
      cost: new CostMeter(),
      store,
      taxonomyVersion: taxonomy.version,
      seed,
      mode: 'substitute',
      cluster: null,
      clusterBy: null,
      poolRoot: '',
      nearRoot: '',
      pickedCategories: [],
      profile: null,
      pool: [],
      variant: null,
      picks: [],
      noneReason: null,
      counts: {},
      options: {
        storeDir: inputData.storeDir,
        taxonomyDir: inputData.taxonomyDir,
        validateSeed: inputData.validateSeed,
        validatePool: inputData.validatePool,
        forceTier: inputData.forceTier,
        verbose: inputData.verbose,
        webhookUrl: inputData.webhookUrl,
      },
    });

    events.emit('seed.loaded', {
      name: seed.name,
      price: seed.price,
      stockBand: seed.stockBand,
      category: seed.category,
      status: seed.status,
    });
    return { runId, sku: inputData.sku, done: false, decision: null };
  },
});

// ------------------------------------------------------- 2. validate seed
const validateSeed = createStep({
  id: 'validate-seed',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (!c.options.validateSeed || !hasApiKey()) {
      c.events.emit('seed.validated', { skipped: true, reason: hasApiKey() ? 'disabled' : 'no api key' });
      return inputData;
    }
    const before = c.seed.category;
    const out = await runValidate({
      skus: [inputData.sku],
      storeDir: c.options.storeDir,
      taxonomyDir: c.options.taxonomyDir,
    });
    if (out.requests > 0) {
      c.cost.record('validate-seed', TIER_MODEL, { ...out.usage, totalTokens: 0 }, 0);
    } else {
      c.cost.saved();
    }

    // The validator may have rewritten the category, which is what the rest of
    // the run searches by, so the seed is re-read rather than reused.
    c.store = new TagStore(c.options.storeDir).load();
    const fresh = c.store.get(inputData.sku);
    if (fresh) c.seed = fresh;

    /**
     * A bare department is not a product category. Retrieval keys off this, so
     * a seed sitting on one gives a pool of everything the tagger could only
     * place at department level — and the recommender then refuses, for a
     * reason that has nothing to do with the customer. Surfaced as a fact on
     * the event rather than silently producing a confusing refusal.
     */
    const departmentRootOnly = Boolean(c.seed.category && !c.seed.category.includes('/'));
    c.events.emit('seed.validated', {
      requests: out.requests,
      alreadyClean: out.requests === 0,
      categoryBefore: before,
      categoryAfter: c.seed.category,
      changed: before !== c.seed.category,
      status: c.seed.status,
      ...(departmentRootOnly ? { warning: 'category is a department root, not a leaf' } : {}),
    });
    return inputData;
  },
});

// --------------------------------------------------------- 3. check stock
const checkStock = createStep({
  id: 'check-stock',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    const available = inStock(c.seed);
    c.events.emit('stock.checked', { stockBand: c.seed.stockBand, inStock: available });
    if (!available) return inputData;

    /**
     * In stock, so there is nothing to substitute. This used to end the run
     * with the seed as its own answer, which is true but useless: a banner
     * showing the exact product someone just looked at tells them nothing they
     * do not already know. It becomes a suggestion instead, and the rest of the
     * run changes shape accordingly.
     */
    c.mode = 'suggest';
    return inputData;
  },
});

// ------------------------------------------------- 4. build the pool (free)
const buildPool = createStep({
  id: 'build-pool',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done) return inputData;
    if (!c.seed.category) {
      c.events.emit('run.failed', { reason: 'seed has no category' });
      // These reasons are shown on the board, which is in English.
      c.noneReason = 'The seed product has no category, so there is nowhere to look.';
      return pass(inputData, 'none');
    }
    /**
     * Stop here rather than spending on a pool that means nothing.
     *
     * Retrieval keys off the category. A bare department is the drawer of
     * products nothing could classify, so tier and both recommender passes
     * would be paid for and then refused. Three runs did exactly that before
     * this guard existed, at three to four calls each.
     */
    if (!c.seed.category.includes('/')) {
      c.events.emit('run.failed', {
        reason: 'seed category is a department root',
        category: c.seed.category,
      });
      c.noneReason =
        `The seed product sits on "${c.seed.category}", which is a department root ` +
        `rather than a product category. Searching it would mean nothing, so this ` +
        `stopped before spending a call.`;
      return pass(inputData, 'none');
    }
    const built = poolFor(c);
    c.poolRoot = built.root;
    c.nearRoot = built.nearRoot;
    const shortlist = shaped(c, built.products);
    c.pool = shortlist;
    c.counts.categoryPool = built.products.length;
    c.counts.shortlist = shortlist.length;
    const bands = [0, 0, 0];
    for (const p of shortlist) bands[band(c, p)]!++;
    c.events.emit('pool.built', {
      mode: c.mode,
      root: built.root,
      nearRoot: built.nearRoot,
      inStock: built.products.length,
      shortlist: shortlist.length,
      ...(c.mode === 'suggest'
        ? { sameCategory: bands[0], sameKind: bands[1], otherSections: bands[2] }
        : {}),
    });
    return inputData;
  },
});

// ------------------------------------------------ 5. promotion (free)
const promoShortcutStep = createStep({
  id: 'promo-shortcut',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done || c.mode !== 'suggest') return inputData;

    /**
     * The cheapest answer there is. A real price cut on the thing the customer
     * was already looking at — or on the same product in another variant — is
     * the offer, and no judgement is needed to see that. Deliberately before
     * every paid step, which is why the agents often never run.
     */
    const hit = promoShortcut(c.seed, poolFor(c).products);
    c.events.emit('promo.checked', {
      threshold: PROMO_THRESHOLD_PCT,
      found: Boolean(hit),
      ...(hit
        ? { how: hit.how, sku: hit.product.sku, name: hit.product.name, discountPct: hit.discountPct }
        : {}),
    });
    if (!hit) return inputData;

    c.picks = [{ product: hit.product, reason: hit.reason }];
    return pass(inputData, hit.how === 'seed' ? 'promo-seed' : 'promo-variant');
  },
});

// ---------------------------------------------------- 6. exact variant
const exactVariant = createStep({
  id: 'exact-variant',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    // Only substitution cares about variants: it is how the same product is
    // found in another colour. With the seed in stock there is no gap to fill.
    if (inputData.done || c.mode === 'suggest') return inputData;

    const match = findExactVariant(c.seed, c.pool);
    c.variant = match;
    c.events.emit('variant.matched', {
      found: Boolean(match),
      ...(match
        ? {
            sku: match.pick.sku,
            name: match.pick.name,
            price: match.pick.price,
            stockBand: match.pick.stockBand,
            alternatives: match.others.length,
          }
        : {}),
    });
    if (!match) return inputData;

    /**
     * The same product in another variant, in stock. There is nothing for a
     * model to decide and no model would do better, so the run stops here at
     * zero cost. Measured on the phone catalogue this is not a rare case.
     */
    c.picks = [
      {
        product: match.pick,
        reason: 'The same product, in stock, in a different variant.',
      },
      ...match.others.slice(0, 4).map((p) => ({
        product: p,
        reason: 'The same product in another variant.',
      })),
    ];
    return pass(inputData, 'exact-variant');
  },
});


// ------------------------------------------ 6. clean the category pool
const validatePool = createStep({
  id: 'validate-pool',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done) return inputData;
    if (!c.options.validatePool || !hasApiKey() || !c.pool.length) {
      c.events.emit('category.pool.validated', {
        category: c.seed.category, pool: c.pool.length, skipped: true,
      });
      return inputData;
    }

    /**
     * Tier is judged relative to the category, so a product filed in the wrong
     * category gets a tier that is coherent for what it actually is and
     * meaningless here — a 299 kr screen protector filed under phones comes
     * back premium, because among accessories it is. Tier cannot detect that
     * error, it inherits it, which is why the category is cleaned before tier
     * and not before the free steps: the deterministic variant match needs an
     * exact name, not a clean category, so it must not pay for this.
     */
    const dirty = c.pool
      .filter((p) => c.store.needsValidation(p, c.taxonomyVersion, p.feedVersion))
      .slice(0, POOL_VALIDATION_CAP);

    if (!dirty.length) {
      c.cost.saved(Math.ceil(c.pool.length / 10));
      c.events.emit('category.pool.validated', {
        category: c.seed.category, pool: c.pool.length, dirty: 0, cached: true,
      });
      return inputData;
    }

    const out = await runValidate({
      skus: dirty.map((p) => p.sku),
      storeDir: c.options.storeDir,
      taxonomyDir: c.options.taxonomyDir,
    });
    if (out.requests > 0) {
      c.cost.record('validate-pool', TIER_MODEL, { ...out.usage, totalTokens: 0 }, 0);
    }

    c.store = new TagStore(c.options.storeDir).load();
    c.pool = shaped(c, poolFor(c).products);
    c.counts.shortlist = c.pool.length;
    c.counts.poolValidated = out.checked;
    c.counts.poolMoved = out.corrected;

    c.events.emit('category.pool.validated', {
      category: c.seed.category,
      pool: c.pool.length,
      checked: out.checked,
      movedOut: out.corrected,
      requests: out.requests,
      cappedAt: dirty.length === POOL_VALIDATION_CAP ? POOL_VALIDATION_CAP : null,
    });
    return inputData;
  },
});

// --------------------------------------------------- 7. classify cluster
const classifyCluster = createStep({
  id: 'classify-cluster',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done || c.mode !== 'suggest') return inputData;

    /**
     * Free first. Where the brand alone settles it the model has nothing to
     * add: measured on this catalogue, that is 10.6% of in-stock seeds, spread
     * evenly across the four groups.
     */
    const free = clusterFromBrand(c.seed);
    if (free) {
      c.cluster = free;
      c.clusterBy = 'brand';
      c.cost.saved();
      c.events.emit('cluster.decided', {
        cluster: free, by: 'brand', brand: c.seed.brand, confidence: 'high',
      });
      return inputData;
    }

    if (!hasApiKey()) {
      c.events.emit('cluster.decided', { skipped: true, reason: 'no api key' });
      return inputData;
    }

    const prompt = clusterPrompt(c.seed);
    const opts = { structuredOutput: { schema: clusterSchema } };
    const fb = clusterClassifierFallback;
    const { result, model: usedModel, ms } = await callModel(
      c, 'classify-cluster', CLUSTER_MODEL,
      () => clusterClassifier.generate(prompt, opts),
      CLUSTER_FALLBACK_MODEL,
      fb ? () => fb.generate(prompt, opts) : null,
    );
    c.cost.record('classify-cluster', usedModel, await readUsage(result), ms);

    const answer = result.object;
    c.cluster = (answer?.cluster as Cluster | undefined) ?? null;
    c.clusterBy = c.cluster ? 'model' : null;
    c.events.emit('cluster.decided', {
      cluster: c.cluster,
      by: 'model',
      reason: answer?.reason ?? null,
      confidence: answer?.confidence ?? null,
    });
    return inputData;
  },
});

// -------------------------------------------------- 8. pick the sections
const pickCategories = createStep({
  id: 'pick-categories',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done || c.mode !== 'suggest') return inputData;
    if (!hasApiKey()) {
      // The department pool and its bands stay as they are: a worse answer
      // than the picker's, but a working one.
      c.events.emit('categories.picked', { skipped: true, reason: 'no api key' });
      return inputData;
    }

    /**
     * The closed set: every second-level node that actually has stock, with
     * its count. 70 of them, about 560 tokens — the whole shop fits in one
     * prompt, so the picker is never limited to the department the product
     * happens to sit in.
     */
    const counts = new Map<string, number>();
    for (const p of c.store.all()) {
      if (!p.category || !inStock(p)) continue;
      const segments = p.category.split('/');
      if (segments.length < 2) continue;
      const key = segments.slice(0, 2).join('/');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const options: CategoryOption[] = [...counts]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const seedKey = c.seed.category!.split('/').slice(0, 2).join('/');
    const seedIndex = options.findIndex((o) => o.path === seedKey);

    const prompt = categoryPickerPrompt({
      seed: c.seed,
      options,
      seedOption: seedIndex >= 0 ? seedIndex + 1 : null,
      cluster: c.cluster ? { label: CLUSTER_LABEL[c.cluster], note: CLUSTER_NOTE[c.cluster] } : null,
    });
    const opts = { structuredOutput: { schema: categoryPickSchema } };
    const fb = categoryPickerFallback;
    const { result, model: usedModel, ms } = await callModel(
      c, 'pick-categories', CATEGORY_PICKER_MODEL,
      () => categoryPicker.generate(prompt, opts),
      CATEGORY_PICKER_FALLBACK_MODEL,
      fb ? () => fb.generate(prompt, opts) : null,
    );
    c.cost.record('pick-categories', usedModel, await readUsage(result), ms);

    const picked: Array<{ path: string; reason: string }> = [];
    const seen = new Set<number>();
    let dropped = 0;
    for (const pick of result.object?.picks ?? []) {
      const i = pick.item - 1;
      const option = options[i];
      // An index outside the list is the one failure this format allows, and
      // it is detectable: drop it rather than inventing a section of the shop.
      if (!option || seen.has(i)) { dropped++; continue; }
      seen.add(i);
      picked.push({ path: option.path, reason: pick.reason });
      if (picked.length >= MAX_PICKED_CATEGORIES) break;
    }

    c.profile = result.object?.profile ?? null;
    c.pickedCategories = picked;

    if (picked.length) {
      const built = poolFor(c);
      c.poolRoot = built.root;
      c.pool = shaped(c, built.products);
      c.counts.categoryPool = built.products.length;
      c.counts.shortlist = c.pool.length;
    }

    c.events.emit('categories.picked', {
      offered: options.length,
      profile: c.profile,
      picked: picked.map((x) => x.path),
      droppedBadIndex: dropped,
      pool: c.pool.length,
      includesOwnSection: picked.some((x) => x.path === seedKey),
    });
    return inputData;
  },
});

// ------------------------------------------------------ 9. classify tier
const classifyTier = createStep({
  id: 'classify-tier',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done) return inputData;
    if (!hasApiKey()) {
      c.events.emit('tier.completed', { skipped: true, reason: 'no api key' });
      return pass(inputData, 'none');
    }

    /**
     * Tier is a judgement WITHIN a kind of product, so it is asked against the
     * node that holds one kind. Suggesting, that is the parent node, and only
     * bands 0 and 1 are put to it: asking whether a mouse is premium next to a
     * laptop would produce a number that means nothing and then filter on it.
     * Band 2 reaches the recommender untiered, on purpose.
     */
    const category = c.mode === 'suggest' ? c.nearRoot : c.seed.category!;
    // The seed needs a tier too, and it is typically out of stock, so it is
    // added explicitly rather than coming from the in-stock pool.
    const subjects = [
      c.seed,
      ...c.pool.filter((p) => p.sku !== c.seed.sku && band(c, p) <= 1),
    ];
    const todo = c.options.forceTier ? subjects : subjects.filter((p) => c.store.needsTier(p));
    const cached = subjects.length - todo.length;
    c.counts.tierCached = cached;
    c.counts.tierClassified = 0;

    c.events.emit('tier.started', {
      category, subjects: subjects.length, toClassify: todo.length, cached,
      requests: Math.ceil(todo.length / TIER_BATCH),
    });
    if (cached) c.cost.saved(Math.ceil(cached / TIER_BATCH));

    const tierFallback = tierClassifierFallback;
    // Same anchor for every batch, so the scale does not depend on the cut.
    const brands = [...new Set(subjects.map((p) => p.brand).filter((b): b is string => Boolean(b)))].sort();
    const throttle = new RpmThrottle();
    const stamp = new Date().toISOString();

    for (let start = 0; start < todo.length; start += TIER_BATCH) {
      const batch = todo.slice(start, start + TIER_BATCH);
      await throttle.take();
      const prompt = tierPrompt(category, batch.map((p) => p.name), brands);
      const opts = { structuredOutput: { schema: tierAnswerSchema } };
      const { result, model: usedModel, ms } = await callModel(
        c, 'classify-tier', TIER_MODEL,
        () => tierClassifier.generate(prompt, opts),
        TIER_FALLBACK_MODEL,
        tierFallback ? () => tierFallback.generate(prompt, opts) : null,
      );
      c.cost.record('classify-tier', usedModel, await readUsage(result), ms);

      const seen = new Set<number>();
      for (const a of result.object?.answers ?? []) {
        const i = a.item - 1;
        const product = batch[i];
        // Guard against index drift: a misaligned answer is dropped, not applied.
        if (!product || seen.has(i)) continue;
        seen.add(i);
        product.tier = a.tier as Tier;
        product.tierConfidence = a.confidence;
        product.tierBy = usedModel;
        product.tierAt = stamp;
        product.tierCategory = product.category;
        c.store.put(product);
        c.counts.tierClassified = (c.counts.tierClassified ?? 0) + 1;
      }
    }

    // Persisted immediately: a tier costs a call, and paying twice for the
    // same judgement is the one thing this whole design exists to avoid.
    const meta = c.store.metadata;
    if (meta && c.counts.tierClassified) c.store.save(meta);

    const dist: Record<string, number> = {};
    for (const p of subjects) if (p.tier !== null) dist[String(p.tier)] = (dist[String(p.tier)] ?? 0) + 1;
    c.events.emit('tier.completed', {
      classified: c.counts.tierClassified, cached, seedTier: c.seed.tier, distribution: dist,
    });

    if (c.seed.tier === null || c.seed.tier === undefined) {
      c.events.emit('run.failed', { reason: 'seed got no tier' });
      return pass(inputData, 'none');
    }
    return inputData;
  },
});

// ------------------------------------------------- 7 & 8. the two passes
async function askRecommender(
  c: RunContext,
  candidates: TaggedProduct[],
  widened: boolean,
): Promise<{ picks: Array<{ product: TaggedProduct; reason: string }>; noneReason: string | null; dropped: number }> {
  const stage = widened ? 'recommend-pass2' : 'recommend-pass1';
  const recFallback = recommenderFallback;
  const prompt = recommendPrompt({
    categoryPath: c.poolRoot || c.seed.category!,
    seed: c.seed,
    candidates,
    widened,
    seedTier: c.seed.tier ?? 0,
    mode: c.mode,
    cluster: c.cluster ? { label: CLUSTER_LABEL[c.cluster], note: CLUSTER_NOTE[c.cluster] } : null,
    profile: c.profile,
    sections: c.pickedCategories.map((x) => x.path),
  });
  const opts = { structuredOutput: { schema: pickSchema } };
  const { result, model: usedModel, ms } = await callModel(
    c, stage, RECOMMENDER_MODEL,
    () => recommender.generate(prompt, opts),
    RECOMMENDER_FALLBACK_MODEL,
    recFallback ? () => recFallback.generate(prompt, opts) : null,
  );
  c.cost.record(stage, usedModel, await readUsage(result), ms);

  const picks: Array<{ product: TaggedProduct; reason: string }> = [];
  const seen = new Set<number>();
  let dropped = 0;
  for (const p of result.object?.picks ?? []) {
    const i = p.item - 1;
    const product = candidates[i];
    // An index outside the list is the one failure mode this format allows,
    // and it is detectable: drop it rather than inventing a product.
    if (!product || seen.has(i)) { dropped++; continue; }
    seen.add(i);
    picks.push({ product, reason: p.reason });
  }
  return { picks, noneReason: result.object?.noneReason ?? null, dropped };
}

/**
 * The candidate list the recommender actually sees.
 *
 * Substituting, it is the tier-matched products and nothing else. Suggesting,
 * a fixed share of the list is reserved for band 2 — the rest of the
 * department — because that is the whole reason the pool was widened. Without
 * the reservation the tier-matched products fill the list and the suggestion
 * collapses back into "more of the same thing", which is what it was before.
 */
function withAdjacent(c: RunContext, tiered: TaggedProduct[]): TaggedProduct[] {
  const adjacent = c.mode === 'suggest' ? c.pool.filter((p) => band(c, p) === 2) : [];
  const reserved = adjacent.length ? Math.min(ADJACENT_CANDIDATES, adjacent.length) : 0;
  return [
    ...spreadSample(tiered, CANDIDATE_CEILING - reserved),
    ...spreadSample(adjacent, reserved),
  ];
}

const recommendSameTier = createStep({
  id: 'recommend-same-tier',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done) return inputData;

    const sameTier = c.pool
      .filter((p) => p.sku !== c.seed.sku && band(c, p) <= 1 && p.tier === c.seed.tier)
      .sort((a, b) => b.price - a.price);
    const candidates = withAdjacent(c, sameTier);
    c.counts.candidatesPass1 = candidates.length;

    if (!candidates.length) {
      c.events.emit('recommend.pass1', { candidates: 0, picks: 0, reason: 'nothing at this tier in stock' });
      return inputData;
    }

    const { picks, noneReason, dropped } = await askRecommender(c, candidates, false);
    c.picks = picks;
    c.noneReason = noneReason;
    c.events.emit('recommend.pass1', {
      candidates: candidates.length,
      offered: sameTier.length,
      picks: picks.length,
      droppedBadIndex: dropped,
      noneReason,
    });
    return picks.length ? pass(inputData, 'model-same-tier') : inputData;
  },
});

const recommendWidened = createStep({
  id: 'recommend-widened',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    if (inputData.done) return inputData;

    const seedTier = c.seed.tier ?? 0;
    const near = c.pool
      .filter(
        (p) =>
          p.sku !== c.seed.sku &&
          band(c, p) <= 1 &&
          p.tier !== null && p.tier !== undefined &&
          Math.abs(p.tier - seedTier) <= 1,
      )
      .sort((a, b) => b.price - a.price);
    const candidates = withAdjacent(c, near);
    c.counts.candidatesPass2 = candidates.length;

    if (!candidates.length) {
      c.events.emit('recommend.pass2', { candidates: 0, picks: 0 });
      return pass(inputData, 'none');
    }

    const { picks, noneReason, dropped } = await askRecommender(c, candidates, true);
    c.picks = picks;
    c.noneReason = noneReason;
    c.events.emit('recommend.pass2', {
      candidates: candidates.length,
      offered: near.length,
      picks: picks.length,
      droppedBadIndex: dropped,
      noneReason,
    });
    return pass(inputData, picks.length ? 'model-widened' : 'none');
  },
});

// -------------------------------------------------------------- 9. finish
const pickSummarySchema = z.object({
  rank: z.number(),
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  oldPrice: z.number().nullable(),
  discountPct: z.number(),
  stockBand: z.string(),
  tier: z.number().nullable(),
  image: z.string().nullable(),
  reason: z.string(),
});

const resultSchema = z.object({
  runId: z.string(),
  decision: z.string(),
  mode: z.string(),
  cluster: z.object({
    id: z.string(), label: z.string(), by: z.string(),
  }).nullable(),
  profile: z.string().nullable(),
  categories: z.array(z.object({ path: z.string(), reason: z.string() })),
  seed: z.object({
    sku: z.string(), name: z.string(), price: z.number(), stockBand: z.string(),
    category: z.string().nullable(), brand: z.string().nullable(),
    tier: z.number().nullable(), status: z.string(),
  }),
  picks: z.array(pickSummarySchema),
  noneReason: z.string().nullable(),
  counts: z.record(z.string(), z.number()),
  cost: z.object({
    calls: z.number(),
    callsAvoidedByCache: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    usd: z.number().nullable(),
    priced: z.boolean(),
    modelMs: z.number(),
    byStage: z.record(z.string(), z.object({
      calls: z.number(), inputTokens: z.number(), outputTokens: z.number(),
    })),
  }),
  timeline: z.array(z.object({
    seq: z.number(), stage: z.string(), elapsedMs: z.number(), data: z.record(z.string(), z.unknown()),
  })),
  webhook: z.object({ configured: z.boolean(), delivered: z.number(), failures: z.array(z.string()) }),
  durationMs: z.number(),
});

const finish = createStep({
  id: 'finish',
  inputSchema: stateSchema,
  outputSchema: resultSchema,
  execute: async ({ inputData }) => {
    const c = ctx(inputData.runId);
    const decision = (inputData.decision ?? 'none') as Decision;
    const cost = c.cost.summary();

    c.events.emit('run.completed', {
      decision,
      mode: c.mode,
      cluster: c.cluster,
      picks: c.picks.length,
      calls: cost.calls,
      callsAvoided: cost.callsAvoidedByCache,
      totalTokens: cost.totalTokens,
      usd: cost.usd,
    });
    const webhook = await c.events.flush();
    const timeline = c.events.timeline();

    const result = {
      runId: inputData.runId,
      decision,
      mode: c.mode,
      cluster: c.cluster
        ? { id: c.cluster, label: CLUSTER_LABEL[c.cluster], by: c.clusterBy ?? 'brand' }
        : null,
      profile: c.profile,
      categories: c.pickedCategories,
      seed: {
        sku: c.seed.sku, name: c.seed.name, price: c.seed.price,
        stockBand: c.seed.stockBand, category: c.seed.category, brand: c.seed.brand,
        tier: c.seed.tier ?? null, status: c.seed.status,
      },
      picks: c.picks.map((p, i) => ({
        rank: i + 1,
        sku: p.product.sku,
        name: p.product.name,
        price: p.product.price,
        oldPrice: p.product.oldPrice,
        discountPct: p.product.discountPct,
        stockBand: p.product.stockBand,
        tier: p.product.tier ?? null,
        image: p.product.image,
        reason: p.reason,
      })),
      noneReason: c.noneReason,
      counts: c.counts,
      cost: {
        calls: cost.calls,
        callsAvoidedByCache: cost.callsAvoidedByCache,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        totalTokens: cost.totalTokens,
        usd: cost.usd,
        priced: cost.priced,
        modelMs: cost.modelMs,
        byStage: cost.byStage,
      },
      timeline: timeline.map((e) => ({
        seq: e.seq, stage: e.stage, elapsedMs: e.elapsedMs, data: e.data,
      })),
      webhook: { configured: c.events.webhookConfigured, ...webhook },
      durationMs: timeline[timeline.length - 1]?.elapsedMs ?? 0,
    };

    contexts.delete(inputData.runId);
    return result;
  },
});

/**
 * Seed in, recommendation out.
 *
 * The order is deliberate and each step is allowed to end the run:
 *
 *    1  load the seed
 *    2  validate it — we are about to search by its category, so it had better
 *       be right
 *    3  stock decides the MODE, not the answer. Out of stock is substitution;
 *       in stock is suggestion, and the steps below read differently for each
 *    4  build the pool — the leaf when substituting, the parent node and
 *       everything under it when suggesting. Reading the store, free
 *    5  suggesting: a real discount above the threshold on the seed or a
 *       direct variant ends it here, free. 3.5% of in-stock seeds land here
 *    6  substituting: the same product in another variant, in stock —
 *       deterministic, free, and better than anything a model would pick.
 *       Deliberately BEFORE any paid step
 *    7  suggesting: which of the four customers this seed implies. Free when
 *       the brand settles it
 *    8  suggesting: ask which SECTIONS of the shop to draw from, against the
 *       70 that have stock. One call, and it replaces a set of quotas I had
 *       guessed, so where to look is a judgement about this customer
 *    9  clean the category, because tier inherits category errors
 *   10  classify premium tier for the seed and the products of its own kind —
 *       never across sections, where the number would mean nothing
 *   11  ask for recommendations among products at the same tier, with a share
 *       of the list reserved for the other sections
 *   12  only if that came back empty, widen to one tier either side
 *
 * Steps short-circuit on `done` rather than branching, so the chain stays one
 * readable sequence and every stage still emits its event.
 */
export const recommendWorkflow = createWorkflow({
  id: 'recommend',
  description: 'Chooses which in-stock product to show for a seed product, with reasons and a cost breakdown.',
  inputSchema: loadSeed.inputSchema,
  outputSchema: resultSchema,
})
  .then(loadSeed)
  .then(validateSeed)
  .then(checkStock)
  .then(buildPool)
  .then(promoShortcutStep)
  .then(exactVariant)
  .then(classifyCluster)
  .then(pickCategories)
  .then(validatePool)
  .then(classifyTier)
  .then(recommendSameTier)
  .then(recommendWidened)
  .then(finish)
  .commit();

export type RecommendResult = z.infer<typeof resultSchema>;
