import { mkdirSync } from 'node:fs';
import { LibSQLStore } from '@mastra/libsql';

/**
 * Durable storage for Mastra itself: workflow run history, step results and
 * observability records.
 *
 * This is separate from the product store. `TagStore` keeps the catalogue as
 * NDJSON because that file is read, grepped and diffed by hand constantly, and
 * being able to `jq` it has been worth more than queries. What goes in here is
 * the other kind of state — what the engine did on each run — which nobody
 * reads by hand and which the library already knows how to persist.
 *
 * It matters for this project specifically: the recommender emits a stage
 * timeline per run, and the front end will want yesterday's runs, not only the
 * one happening now. In memory that history dies with the process.
 *
 * SQLite file by default, under .cache (gitignored). Point MASTRA_DB_URL at a
 * Turso database to run the same code against a remote one.
 */
const url = process.env.MASTRA_DB_URL ?? 'file:.cache/mastra.db';

if (url.startsWith('file:')) {
  const dir = url.slice('file:'.length).split('/').slice(0, -1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
}

export const bannerStorage = new LibSQLStore({
  id: 'banner-factory',
  url,
  ...(process.env.MASTRA_DB_AUTH_TOKEN ? { authToken: process.env.MASTRA_DB_AUTH_TOKEN } : {}),
});
