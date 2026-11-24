import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { loadTaxonomy } from '../../taxonomy/index.js';
import { TagStore } from '../../store/index.js';
import type { TaggedProduct } from '../../types.js';
import { categoryValidator, hasApiKey, VALIDATOR_MODEL } from '../agents/category-validator.js';
import { categoryConfirmer, confirmPrompt, confirmSchema } from '../agents/category-enricher.js';
import { publishProducts } from '../../store/firestore-products.js';
import { RPM_LIMIT, RpmThrottle, retryPlanFor } from '../rpm.js';
import { readUsage } from '../../cost/index.js';

/**
 * Several products per request. This started as a token optimisation and turned
 * out to be a hard requirement: the Gemini free tier allows 15 requests per
 * minute, so one call per product cannot clean a recommendation list.
 */
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

const batchAnswerSchema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int().describe('The item number as given in the prompt'),
      choice: z.number().int().describe('Index of the chosen option, or -1 if none fits'),
      confidence: z.enum(['high', 'low']),
    }),
  ),
});

const outcomeSchema = z.object({
  sku: z.string(),
  name: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  /** `filled` is a product the deterministic tagger left empty — not a correction. */
  status: z.enum(['validated', 'corrected', 'filled', 'unresolved', 'skipped', 'error']),
  confidence: z.enum(['high', 'low']).nullable(),
  optionsOffered: z.number(),
  note: z.string().nullable(),
});

export type ValidationOutcome = z.infer<typeof outcomeSchema>;

interface Entry {
  product: TaggedProduct;
  options: string[];
}

/** A bare department is a drawer, not a category. Never write one. */
const isUsableCategory = (path: string) => path.includes('/');

const validate = createStep({
  id: 'validate-products',
  inputSchema: z.object({
    skus: z.array(z.string()).describe('Products to check — typically the seed plus the recommendations'),
    storeDir: z.string().optional(),
    taxonomyDir: z.string().optional(),
    force: z.boolean().default(false),
    batchSize: z.number().int().min(1).max(40).default(BATCH_SIZE),
  }),
  outputSchema: z.object({
    model: z.string(),
    requested: z.number(),
    checked: z.number(),
    alreadyClean: z.number(),
    validated: z.number(),
    corrected: z.number(),
    filled: z.number(),
    stillUnresolved: z.number(),
    errors: z.number(),
    requests: z.number(),
    /** Measured token use, so the caller can put this on the bill. */
    usage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
    }),
    skippedNoApiKey: z.boolean(),
    /** Documents mirrored to Firestore for the products this run settled. */
    published: z.number(),
    publishSkipped: z.string().nullable(),
    durationMs: z.number(),
    outcomes: z.array(outcomeSchema),
  }),
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const taxonomy = loadTaxonomy(inputData.taxonomyDir);
    const store = new TagStore(inputData.storeDir).load();
    const departments = [...new Set(taxonomy.categories.map((c) => c.department))];
    const categoriesByDepartment = new Map<string, string[]>();
    for (const c of taxonomy.categories) {
      const list = categoriesByDepartment.get(c.department) ?? [];
      list.push(c.path);
      categoriesByDepartment.set(c.department, list);
    }
    const throttle = new RpmThrottle(RPM_LIMIT);

    const outcomes: ValidationOutcome[] = [];
    let alreadyClean = 0;
    let requests = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const noKey = !hasApiKey();

    const queue: Array<{ product: TaggedProduct; options: string[] }> = [];

    for (const sku of inputData.skus) {
      const product = store.get(sku);
      if (!product) {
        outcomes.push({
          sku, name: '', before: null, after: null, status: 'error',
          confidence: null, optionsOffered: 0, note: 'SKU not in store',
        });
        continue;
      }
      if (!store.needsValidation(product, taxonomy.version, product.feedVersion) && !inputData.force) {
        alreadyClean++;
        continue;
      }
      if (noKey) {
        outcomes.push({
          sku, name: product.name, before: product.category, after: product.category,
          status: 'skipped', confidence: null, optionsOffered: 0,
          note: 'no GOOGLE_GENERATIVE_AI_API_KEY in env',
        });
        continue;
      }
      // No candidates means skip straight to department narrowing.
      queue.push({ product, options: product.categoryCandidates });
    }

    const apply = (
      entry: { product: TaggedProduct; options: string[] },
      choice: number,
      confidence: 'high' | 'low',
      onRejected: ((entry: { product: TaggedProduct; options: string[] }) => void) | null,
    ) => {
      const { product, options } = entry;
      const before = product.category;
      const chosen = choice >= 0 && choice < options.length ? options[choice]! : null;
      // A department root would read as a correction and destroy retrieval, so
      // it is treated as "no answer" and sent to the next, narrower question.
      const picked = chosen !== null && isUsableCategory(chosen) ? chosen : null;

      if (picked === null && onRejected) {
        onRejected(entry);
        return;
      }

      /**
       * An answer that is an ANCESTOR of what we already had is not a
       * correction, it is a loss. The escape hatch offers the 11 departments,
       * which is the right question for a product with no category at all and
       * the wrong one for a product the tagger already placed on a leaf.
       *
       * This cost a real run. A Nintendo Switch 2 console sat correctly on
       * `gaming/spillekonsol-tilbehor/nintendo-switch`; the model rejected its
       * own candidate list, the hatch offered departments, it answered
       * `gaming`, and that overwrote the leaf. Every later step searched by
       * category, so the recommender got 155 unrelated gaming products and
       * refused — correctly, on input we had broken ourselves.
       */
      if (picked !== null && before !== null && before.startsWith(`${picked}/`)) {
        product.validationNote = `kept ${before}; model offered the broader ${picked}`;
        product.validatedAt = new Date().toISOString();
        product.validatedBy = VALIDATOR_MODEL;
        store.put(product);
        outcomes.push({
          sku: product.sku,
          name: product.name,
          before,
          after: before,
          status: 'validated',
          confidence: 'low',
          optionsOffered: options.length,
          note: product.validationNote,
        });
        return;
      }

      if (picked === null) {
        product.status = 'unresolved';
        product.validationNote = 'model found no fitting option';
      } else {
        product.category = picked;
        product.categoryMethod = picked === before ? product.categoryMethod : 'llm';
        product.status = before === null ? 'corrected' : picked === before ? 'validated' : 'corrected';
        product.validationNote = null;
      }
      product.validatedAt = new Date().toISOString();
      product.validatedBy = VALIDATOR_MODEL;
      store.put(product);

      outcomes.push({
        sku: product.sku,
        name: product.name,
        before,
        after: product.category,
        // A fill and a correction are different facts and must not be averaged.
        status:
          picked === null ? 'unresolved'
          : before === null ? 'filled'
          : picked === before ? 'validated'
          : 'corrected',
        confidence,
        optionsOffered: options.length,
        note: product.validationNote,
      });
    };

    const runBatches = async (
      entries: Entry[],
      handlers: {
        onRejected?: ((entry: Entry) => void) | null;
        /** Takes the raw choice instead of applying it, for the narrowing pass. */
        onAnswer?: ((entry: Entry, choice: number) => void) | null;
        /** One option list for the whole batch, printed once instead of per item. */
        shared?: boolean;
      } = {},
    ) => {
    for (let start = 0; start < entries.length; start += inputData.batchSize) {
      const batch = entries.slice(start, start + inputData.batchSize);
      /**
       * With a shared list the options are printed once. That is what makes
       * narrowing inside a department affordable: `hjem-have` has 201
       * categories, and repeating them per item would be 10x the prompt.
       */
      const prompt = handlers.shared
        ? `Options:\n${(batch[0]?.options ?? []).map((o, j) => `   ${j} ${o}`).join('\n')}\n\n` +
          `Products:\n${batch.map((entry, i) => `${i + 1}) ${entry.product.name}`).join('\n')}`
        : batch
            .map((entry, i) => {
              const opts = entry.options.map((o, j) => `   ${j} ${o}`).join('\n');
              return `${i + 1}) ${entry.product.name}\n${opts}`;
            })
            .join('\n\n');

      let answered = false;
      for (let attempt = 0; attempt <= MAX_RETRIES && !answered; attempt++) {
        try {
          await throttle.take();
          requests++;
          const instruction = handlers.shared
            ? 'Classify each product below. Every product uses the same numbered list of options.'
            : 'Classify each product below. Answer once per item, using that item\'s own options.';
          const result = await categoryValidator.generate(
            `${instruction}\n\n${prompt}`,
            { structuredOutput: { schema: batchAnswerSchema } },
          );
          const used = await readUsage(result);
          inputTokens += used?.inputTokens ?? 0;
          outputTokens += used?.outputTokens ?? 0;
          const answers = result.object?.answers;
          if (!answers?.length) throw new Error('model returned no answers');

          const seen = new Set<number>();
          for (const a of answers) {
            const idx = a.item - 1;
            const entry = batch[idx];
            // Guard against index drift: a misaligned answer is dropped, not applied.
            if (!entry || seen.has(idx)) continue;
            seen.add(idx);
            if (handlers.onAnswer) handlers.onAnswer(entry, a.choice);
            else apply(entry, a.choice, a.confidence, handlers.onRejected ?? null);
          }
          for (let i = 0; i < batch.length; i++) {
            if (seen.has(i)) continue;
            const entry = batch[i]!;
            outcomes.push({
              sku: entry.product.sku, name: entry.product.name,
              before: entry.product.category, after: entry.product.category,
              status: 'error', confidence: null, optionsOffered: entry.options.length,
              note: 'no answer returned for this item',
            });
          }
          answered = true;
        } catch (error) {
          // Rate limits wait as instructed; provider 503s back off. Before
          // this covered both, one 503 could end a whole validation pass.
          const plan = retryPlanFor(error, attempt);
          if (plan && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, plan.delayMs));
            continue;
          }
          for (const entry of batch) {
            outcomes.push({
              sku: entry.product.sku, name: entry.product.name,
              before: entry.product.category, after: entry.product.category,
              status: 'error', confidence: null, optionsOffered: entry.options.length,
              note: error instanceof Error ? error.message.slice(0, 200) : String(error),
            });
          }
          answered = true;
        }
      }
    }
    };

    const markUnresolved = (entry: Entry, note: string) => {
      const { product, options } = entry;
      product.status = 'unresolved';
      product.validationNote = note;
      product.validatedAt = new Date().toISOString();
      product.validatedBy = VALIDATOR_MODEL;
      store.put(product);
      outcomes.push({
        sku: product.sku, name: product.name, before: product.category,
        after: product.category, status: 'unresolved', confidence: null,
        optionsOffered: options.length, note,
      });
    };

    /**
     * 0. One yes-or-no for everything a rule already placed.
     *
     * These reach this point because the match was imperfect: a glued Danish
     * word was split and the tail assumed to be the type, or two categories
     * tied. The rule is usually right, so the cheapest useful question is
     * whether to keep it — a boolean, not a choice among five paths. Only the
     * products that come back "no" pay for the longer question below.
     *
     * This is also WHEN it is asked. A bulk pass would confirm 3,881 products
     * whose categories mostly never come up; here the bill is paid by the
     * runs that actually search those categories.
     */
    const placed = queue.filter((e) => e.product.category !== null);
    const afterConfirm: Entry[] = queue.filter((e) => e.product.category === null);

    for (let start = 0; start < placed.length; start += inputData.batchSize) {
      const batch = placed.slice(start, start + inputData.batchSize);
      const items = batch.map((e) => ({ name: e.product.name, proposed: e.product.category! }));
      try {
        await throttle.take();
        requests++;
        const result = await categoryConfirmer.generate(confirmPrompt(items), {
          structuredOutput: { schema: confirmSchema },
        });
        const used = await readUsage(result);
        inputTokens += used?.inputTokens ?? 0;
        outputTokens += used?.outputTokens ?? 0;

        const seen = new Set<number>();
        for (const a of result.object?.answers ?? []) {
          const i = a.item - 1;
          const entry = batch[i];
          // An index outside the batch is the one failure this format allows.
          if (!entry || seen.has(i)) continue;
          seen.add(i);
          if (!a.belongs) { afterConfirm.push(entry); continue; }
          const product = entry.product;
          product.status = 'validated';
          product.categoryDecidedBy = 'confirmed';
          product.validatedAt = new Date().toISOString();
          product.validatedBy = VALIDATOR_MODEL;
          product.validationNote = 'A rule guessed it from a word ending and the model agreed.';
          store.put(product);
          outcomes.push({
            sku: product.sku, name: product.name, before: product.category,
            after: product.category, status: 'validated', confidence: 'high',
            optionsOffered: 0, note: product.validationNote,
          });
        }
        // Anything the batch did not answer for still deserves the long question.
        batch.forEach((entry, i) => { if (!seen.has(i)) afterConfirm.push(entry); });
      } catch {
        // A failed confirmation is not a verdict: fall through to the choice.
        afterConfirm.push(...batch);
      }
    }

    /**
     * Then three questions, each narrower than the last.
     *
     * The middle one used to be the end of the line, and that was the bug. A
     * product the tagger misfiled would be rejected in pass 1, answered with a
     * department in pass 2, and that department got written as its category.
     * Three real runs died on it: a cleaning robot became `hjem-have`, a drone
     * `sport-fritid-hobby`, a wine cabinet `hvidevarer`. Every one of those
     * pools is the drawer of products nothing could classify, so searching it
     * is meaningless and the recommender refused — on input we had broken.
     *
     * Now a department is only ever a step on the way to a leaf.
     */
    const needsDepartment: Entry[] = [...afterConfirm.filter((e) => !e.options.length)];
    const withCandidates = afterConfirm.filter((e) => e.options.length > 0);

    // 1. the tagger's own candidates, for products it actually placed.
    if (withCandidates.length) {
      await runBatches(withCandidates, { onRejected: (entry) => needsDepartment.push(entry) });
    }

    // 2. which of the 11 departments. Not an answer, a narrowing.
    const needsLeaf = new Map<string, Entry[]>();
    if (needsDepartment.length) {
      await runBatches(
        needsDepartment.map((e) => ({ product: e.product, options: departments })),
        {
          shared: true,
          onAnswer: (entry, choice) => {
            const dept = choice >= 0 && choice < departments.length ? departments[choice]! : null;
            if (dept === null) {
              markUnresolved(entry, 'model placed it in no department');
              return;
            }
            const list = needsLeaf.get(dept) ?? [];
            list.push(entry);
            needsLeaf.set(dept, list);
          },
        },
      );
    }

    // 3. which category inside that department. One shared option list per
    //    department, so the cost is one prompt per department, not per product.
    for (const [dept, entries] of needsLeaf) {
      const paths = (categoriesByDepartment.get(dept) ?? []).filter(isUsableCategory);
      if (!paths.length) {
        for (const entry of entries) markUnresolved(entry, `no leaf categories under ${dept}`);
        continue;
      }
      await runBatches(
        entries.map((e) => ({ product: e.product, options: paths })),
        { shared: true },
      );
    }

    /**
     * The handful this run just settled goes to Firestore, and nothing else.
     *
     * This is the whole shape of the mirror: a category is published when a
     * run actually decides it, so the copy fills in where the shop is being
     * used. Reported on the result, never thrown — the verdict is already in
     * the local store, which is what everything here reads.
     */
    const decided = outcomes
      .filter((o) => o.status === 'validated' || o.status === 'corrected' || o.status === 'filled')
      .map((o) => o.sku);
    let published = 0;
    let publishSkipped: string | null = null;
    if (decided.length) {
      const out = await publishProducts(store, { only: decided });
      published = out.written;
      publishSkipped = out.unavailable;
    }

    // Saved last, so the publication stamps the mirror just set are written
    // with everything else rather than being lost on the next load.
    const meta = store.metadata;
    if (meta) store.save(meta);

    const count = (s: ValidationOutcome['status']) => outcomes.filter((o) => o.status === s).length;
    return {
      published,
      publishSkipped,
      model: VALIDATOR_MODEL,
      requested: inputData.skus.length,
      checked: outcomes.length,
      alreadyClean,
      validated: count('validated'),
      corrected: count('corrected'),
      filled: count('filled'),
      stillUnresolved: count('unresolved'),
      errors: count('error'),
      requests,
      usage: { inputTokens, outputTokens },
      skippedNoApiKey: noKey,
      durationMs: Date.now() - startedAt,
      outcomes,
    };
  },
});

/**
 * On-demand cleaning. Called with the seed product when it goes on screen and
 * with whatever the recommender returns, so the base gets cleaner exactly where
 * it is being used, and nowhere else.
 */
export const validateProductsWorkflow = createWorkflow({
  id: 'validate-products',
  description: 'Confirms or corrects category tags for specific products using the cheapest model.',
  inputSchema: validate.inputSchema,
  outputSchema: validate.outputSchema,
})
  .then(validate)
  .commit();
