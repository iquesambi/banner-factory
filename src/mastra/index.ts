import { Mastra } from '@mastra/core';
import { categoryValidator } from './agents/category-validator.js';
import { tierClassifier } from './agents/tier-classifier.js';
import { recommender } from './agents/recommender.js';
import { copywriter } from './agents/copywriter.js';
import { strategist } from './agents/strategist.js';
import { artDirector } from './agents/art-director.js';
import { tagCatalogWorkflow } from './workflows/tag-catalog.js';
import { validateProductsWorkflow } from './workflows/validate-products.js';
import { recommendWorkflow } from './workflows/recommend.js';
import { composeWorkflow } from './workflows/compose.js';
import { artDirectWorkflow } from './workflows/art-direct.js';
import { bannerLogger } from './logger.js';
import { bannerStorage } from './storage.js';

export const mastra = new Mastra({
  agents: { categoryValidator, tierClassifier, recommender, copywriter, strategist, artDirector },
  workflows: { tagCatalogWorkflow, validateProductsWorkflow, recommendWorkflow, composeWorkflow, artDirectWorkflow },
  /**
   * One logger for the library and for our own run events. It is a Mastra
   * ConsoleLogger with a filter rather than a disabled logger: see
   * ./logger.ts for exactly what the filter drops and why.
   */
  logger: bannerLogger,
  /**
   * Workflow run history, persisted. Without this Mastra falls back to an
   * in-memory store and every run's record dies with the process — which the
   * library warns about on every start, and rightly so: the stage timeline is
   * the thing a front end will want to look back at.
   */
  storage: bannerStorage,
});

export {
  tagCatalogWorkflow,
  validateProductsWorkflow,
  recommendWorkflow,
  composeWorkflow,
  artDirectWorkflow,
  categoryValidator,
  tierClassifier,
  recommender,
  copywriter,
  strategist,
  artDirector,
};
