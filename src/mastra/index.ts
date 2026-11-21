import { Mastra } from '@mastra/core';
import { categoryValidator } from './agents/category-validator.js';
import { tagCatalogWorkflow } from './workflows/tag-catalog.js';
import { validateProductsWorkflow } from './workflows/validate-products.js';

export const mastra = new Mastra({
  agents: { categoryValidator },
  workflows: { tagCatalogWorkflow, validateProductsWorkflow },
});

export { tagCatalogWorkflow, validateProductsWorkflow, categoryValidator };
