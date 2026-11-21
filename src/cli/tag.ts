import { loadFeed } from '../feed/load.js';
import { loadTaxonomy } from '../taxonomy/index.js';
import { tagCatalog } from '../tagger/index.js';
import { TagStore } from '../store/index.js';

const t0 = Date.now();
const taxonomy = loadTaxonomy();
const feed = loadFeed();
console.log(`feed ${feed.products.length} produtos (v${feed.version}) · taxonomia v${taxonomy.version}`);

const { products, tagger, stats } = tagCatalog(feed.products, taxonomy, feed.version);
const pct = (n: number) => `${((n / stats.total) * 100).toFixed(1)}%`;

console.log(`\n=== TAGGING DETERMINISTICO (custo zero) em ${Date.now() - t0}ms ===`);
console.log(`  marca      : ${stats.withBrand} (${pct(stats.withBrand)})`);
console.log(`  categoria  : ${stats.withCategory} (${pct(stats.withCategory)})`);
console.log(`  unresolved : ${stats.unresolved} (${pct(stats.unresolved)})`);

console.log(`\n  por metodo:`);
for (const [k, v] of Object.entries(stats.byMethod).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(10)} ${v}`);
}
console.log(`\n  por departamento:`);
for (const [k, v] of Object.entries(stats.byDepartment).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(v).padStart(6)}  ${k}  ${pct(v)}`);
}

const ts = tagger.stats();
console.log(`\n  termos: ${ts.terms} · discriminantes: ${ts.discriminating}`);
console.log(`  descartados por frequencia (>15% do catalogo):`);
for (const d of ts.droppedAsTooCommon.slice(0, 12)) {
  console.log(`    ${d.term.padEnd(16)} df=${d.df}`);
}

new TagStore().replaceAll(products).save({
  feedVersion: feed.version,
  taxonomyVersion: taxonomy.version,
  taggedAt: new Date().toISOString(),
  count: products.length,
});
console.log(`\nstore salvo em .cache/store (${products.length} produtos)`);
