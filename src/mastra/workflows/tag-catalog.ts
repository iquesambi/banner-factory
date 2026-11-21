import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { loadFeed } from '../../feed/load.js';
import { loadTaxonomy } from '../../taxonomy/index.js';
import { tagCatalog } from '../../tagger/index.js';
import { TagStore } from '../../store/index.js';

const statsSchema = z.object({
  total: z.number(),
  withBrand: z.number(),
  withCategory: z.number(),
  unresolved: z.number(),
  byDepartment: z.record(z.string(), z.number()),
  byMethod: z.record(z.string(), z.number()),
});

/**
 * Rebuilds the whole tagged base from the feed, deterministically.
 * Re-runnable and free: no model is called, so a new feed drop or a new
 * taxonomy snapshot just means running this again.
 */
const rebuild = createStep({
  id: 'rebuild-base',
  inputSchema: z.object({
    feedPath: z.string().optional(),
    taxonomyDir: z.string().optional(),
    storeDir: z.string().optional(),
    /** Keep validation flags for products whose name and versions are unchanged. */
    preserveValidated: z.boolean().default(true),
  }),
  outputSchema: z.object({
    feedVersion: z.string(),
    taxonomyVersion: z.string(),
    durationMs: z.number(),
    carriedOverValidations: z.number(),
    stats: statsSchema,
  }),
  execute: async ({ inputData }) => {
    const startedAt = Date.now();
    const taxonomy = loadTaxonomy(inputData.taxonomyDir);
    const feed = loadFeed(inputData.feedPath);
    const { products, stats } = tagCatalog(feed.products, taxonomy, feed.version);

    const store = new TagStore(inputData.storeDir);
    let carriedOver = 0;

    if (inputData.preserveValidated && store.exists()) {
      const previous = new TagStore(inputData.storeDir).load();
      for (const p of products) {
        const old = previous.get(p.sku);
        if (!old) continue;
        const stillValid =
          (old.status === 'validated' || old.status === 'corrected') &&
          old.taxonomyVersion === taxonomy.version &&
          old.name === p.name;
        if (!stillValid) continue;
        p.category = old.category;
        p.categoryMethod = old.categoryMethod;
        p.status = old.status;
        p.validatedAt = old.validatedAt;
        p.validatedBy = old.validatedBy;
        p.validationNote = old.validationNote;
        carriedOver++;
      }
    }

    store.replaceAll(products).save({
      feedVersion: feed.version,
      taxonomyVersion: taxonomy.version,
      taggedAt: new Date().toISOString(),
      count: products.length,
    });

    return {
      feedVersion: feed.version,
      taxonomyVersion: taxonomy.version,
      durationMs: Date.now() - startedAt,
      carriedOverValidations: carriedOver,
      stats,
    };
  },
});

export const tagCatalogWorkflow = createWorkflow({
  id: 'tag-catalog',
  description: 'Deterministic brand + category tagging of the whole product feed. Zero model cost.',
  inputSchema: rebuild.inputSchema,
  outputSchema: rebuild.outputSchema,
})
  .then(rebuild)
  .commit();
