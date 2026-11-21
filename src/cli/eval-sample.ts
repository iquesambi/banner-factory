import { writeFileSync, mkdirSync } from 'node:fs';
import { tagCatalogWorkflow, validateProductsWorkflow } from '../mastra/index.js';
import { TagStore } from '../store/index.js';
import { mulberry32, sample, wilson, pct } from '../eval/stats.js';
import { VALIDATOR_MODEL, hasApiKey } from '../mastra/agents/category-validator.js';
import type { TaggedProduct } from '../types.js';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const SIZE = Number(flag('size', '25'));
const SEED = Number(flag('seed', String(Date.now() % 100000)));
const STRATIFIED = args.includes('--stratified');

async function run<T>(workflow: { createRun: (...a: never[]) => unknown }, inputData: unknown) {
  const r = await (workflow.createRun as () => Promise<{ start: (a: unknown) => Promise<unknown> }>)();
  const outcome = (await r.start({ inputData })) as { status: string; result?: T; error?: unknown };
  if (outcome.status !== 'success') {
    throw new Error(`workflow failed: ${JSON.stringify(outcome.error ?? outcome.status)}`);
  }
  return outcome.result as T;
}

console.log('=== 1. REBUILD DETERMINISTICO DA BASE (custo zero) ===');
const tagResult = await run<{
  feedVersion: string; taxonomyVersion: string; durationMs: number;
  carriedOverValidations: number;
  stats: { total: number; withBrand: number; withCategory: number; unresolved: number };
}>(tagCatalogWorkflow, { preserveValidated: true });

const s = tagResult.stats;
console.log(`  ${s.total} produtos em ${tagResult.durationMs}ms`);
console.log(`  marca     : ${s.withBrand} (${pct(s.withBrand / s.total)})`);
console.log(`  categoria : ${s.withCategory} (${pct(s.withCategory / s.total)})`);
console.log(`  unresolved: ${s.unresolved} (${pct(s.unresolved / s.total)})`);
console.log(`  validacoes preservadas de rodada anterior: ${tagResult.carriedOverValidations}`);

const store = new TagStore().load();
const pool: TaggedProduct[] = store.all();

const rng = mulberry32(SEED);
let picked: TaggedProduct[];
if (STRATIFIED) {
  const buckets = new Map<string, TaggedProduct[]>();
  for (const p of pool) {
    const dept = p.category?.split('/')[0] ?? 'unresolved';
    const band = p.price < 500 ? 'low' : p.price < 5000 ? 'mid' : 'high';
    const key = `${dept}|${band}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(p);
  }
  const keys = sample([...buckets.keys()], SIZE, rng);
  picked = keys.map((k) => sample(buckets.get(k)!, 1, rng)[0]!);
  while (picked.length < SIZE) picked.push(...sample(pool, 1, rng));
} else {
  picked = sample(pool, SIZE, rng);
}

console.log(`\n=== 2. AMOSTRA DE ${picked.length} (seed=${SEED}${STRATIFIED ? ', estratificada' : ', aleatoria'}) ===`);
for (const p of picked) {
  console.log(`  ${p.sku.padEnd(10)} ${p.name.slice(0, 44).padEnd(46)} ${p.category ?? '— unresolved'}`);
}

console.log(`\n=== 3. VALIDACAO COM MODELO (${VALIDATOR_MODEL}) ===`);
if (!hasApiKey()) {
  console.log('  ! GOOGLE_GENERATIVE_AI_API_KEY ausente — etapa do modelo sera marcada como skipped.');
}

type Outcome = {
  sku: string; name: string; before: string | null; after: string | null;
  status: string; confidence: string | null; optionsOffered: number; note: string | null;
};
type ValidationResult = {
  model: string; requested: number; checked: number; alreadyClean: number;
  validated: number; corrected: number; filled: number; stillUnresolved: number;
  errors: number; requests: number; skippedNoApiKey: boolean; durationMs: number;
  outcomes: Outcome[];
};

const validation = await run<ValidationResult>(validateProductsWorkflow, {
  skus: picked.map((p) => p.sku),
  force: true,
});

const MARKS: Record<string, string> = {
  validated: 'ok   ', corrected: 'FIX  ', filled: 'fill ',
  unresolved: '??   ', skipped: 'skip ', error: 'ERR  ',
};
for (const o of validation.outcomes) {
  const change = o.status === 'corrected' || o.status === 'filled'
    ? `${o.before ?? '—'}  =>  ${o.after}`
    : (o.after ?? '—');
  console.log(`  ${MARKS[o.status] ?? '     '}${o.name.slice(0, 40).padEnd(42)} ${change}${o.note ? `  (${o.note.slice(0, 60)})` : ''}`);
}

console.log(`\n=== 4. ESTIMATIVA DA LIMPEZA ===`);
console.log(`  checados        : ${validation.checked}`);
console.log(`  requests ao LLM : ${validation.requests}  (lotes, nao 1 por produto)`);
console.log(`  ja limpos       : ${validation.alreadyClean}`);
console.log(`  tempo           : ${(validation.durationMs / 1000).toFixed(1)}s`);
console.log(`  erros           : ${validation.errors}`);

/**
 * Two different questions, deliberately not averaged together:
 *  - precision: of the tags the deterministic tagger DID produce, how many hold up
 *  - fill rate: of the products it left empty, how many the model could place
 */
/**
 * Only tags the DETERMINISTIC tagger produced count towards its precision.
 * A category a previous model pass wrote would otherwise be re-confirmed here
 * and measured as the tagger being right — that is the model agreeing with
 * itself, which tells us nothing about the tagger.
 */
const DETERMINISTIC = new Set(['synonym', 'phrase', 'exact', 'compound']);
const originMethod = new Map(picked.map((p) => [p.sku, p.categoryMethod]));
const isDeterministic = (sku: string) => DETERMINISTIC.has(originMethod.get(sku) ?? '');

const covered = validation.outcomes.filter((o) => o.before !== null && isDeterministic(o.sku));
const uncovered = validation.outcomes.filter((o) => o.before === null);
const modelOrigin = validation.outcomes.filter((o) => o.before !== null && !isDeterministic(o.sku));
if (modelOrigin.length) {
  console.log(`\n  (${modelOrigin.length} produtos fora da conta de precisao: categoria veio de rodada anterior do modelo)`);
}
const decidedCovered = covered.filter((o) => o.status !== 'error' && o.status !== 'skipped');
const correctCovered = decidedCovered.filter((o) => o.status === 'validated');
const decidedUncovered = uncovered.filter((o) => o.status !== 'error' && o.status !== 'skipped');
const filledUncovered = decidedUncovered.filter((o) => o.status === 'filled');

console.log(`\n  A) PRECISAO do tagger onde ele JA tinha categoria`);
if (decidedCovered.length > 0) {
  const acc = wilson(correctCovered.length, decidedCovered.length);
  console.log(`     confirmados   : ${correctCovered.length}/${decidedCovered.length}`);
  console.log(`     corrigidos    : ${decidedCovered.filter((o) => o.status === 'corrected').length}`);
  console.log(`     tagger errado : ${decidedCovered.filter((o) => o.status === 'unresolved').length}  (modelo disse que nenhuma opcao serve)`);
  console.log(`     ponto         : ${pct(acc.point)}`);
  console.log(`     IC 95% Wilson : ${pct(acc.low)} — ${pct(acc.high)}`);
  console.log(`\n     Extrapolando para ${s.withCategory} produtos com categoria automatica:`);
  console.log(`       corretos    : ~${Math.round(acc.point * s.withCategory)}  (faixa ${Math.round(acc.low * s.withCategory)} — ${Math.round(acc.high * s.withCategory)})`);
  console.log(`       a corrigir  : ~${Math.round((1 - acc.point) * s.withCategory)}`);
  if (decidedCovered.length < 30) {
    console.log(`\n     ! n=${decidedCovered.length} e pequeno: o intervalo e largo de proposito. Rode --size=100.`);
  }
} else {
  console.log(`     sem decisoes do modelo sobre produtos ja categorizados.`);
}

console.log(`\n  B) PREENCHIMENTO onde o tagger nao tinha nada`);
if (decidedUncovered.length > 0) {
  const fill = wilson(filledUncovered.length, decidedUncovered.length);
  console.log(`     preenchidos   : ${filledUncovered.length}/${decidedUncovered.length}`);
  console.log(`     ainda sem     : ${decidedUncovered.filter((o) => o.status === 'unresolved').length}`);
  console.log(`     ponto         : ${pct(fill.point)}`);
  console.log(`     IC 95% Wilson : ${pct(fill.low)} — ${pct(fill.high)}`);
  console.log(`\n     Extrapolando para ${s.unresolved} unresolved:`);
  console.log(`       recuperaveis: ~${Math.round(fill.point * s.unresolved)}  (faixa ${Math.round(fill.low * s.unresolved)} — ${Math.round(fill.high * s.unresolved)})`);
  console.log(`\n     ! Preenchimento aqui e no nivel de DEPARTAMENTO (11 opcoes), nao de folha.`);
} else {
  console.log(`     sem decisoes do modelo sobre produtos unresolved.`);
}

const counts = store.statusCounts();
console.log(`\n=== 5. ESTADO DA BASE ===`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${String(v).padStart(6)}  ${pct(v / s.total)}`);
}

mkdirSync('.cache/eval', { recursive: true });
const reportPath = `.cache/eval/sample-${SEED}.json`;
writeFileSync(reportPath, JSON.stringify({
  seed: SEED, size: picked.length, stratified: STRATIFIED,
  feedVersion: tagResult.feedVersion, taxonomyVersion: tagResult.taxonomyVersion,
  model: validation.model, tagging: s, validation, storeStatus: counts,
}, null, 2));
console.log(`\nrelatorio: ${reportPath}`);
console.log(`reproduza esta amostra com: npm run eval:sample -- --seed=${SEED}${STRATIFIED ? ' --stratified' : ''}`);
