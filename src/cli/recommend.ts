import { writeFileSync, mkdirSync } from 'node:fs';
import { recommendWorkflow } from '../mastra/index.js';
import type { RecommendResult } from '../mastra/workflows/recommend.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => args.includes(`--${name}`);

const skus = args.filter((a) => !a.startsWith('--'));
if (!skus.length) {
  console.error(`uso: npm run recommend -- <sku> [sku...] [opcoes]

  --quiet              nao imprime a timeline ao vivo
  --free               so os caminhos gratuitos: nao valida nada, nao chama modelo
  --no-validate-seed   pula a validacao de categoria da semente
  --no-validate-pool   pula a limpeza da categoria
  --retier             reclassifica faixa mesmo onde ja existe
  --webhook=<url>      POST de cada evento (ou BANNER_WEBHOOK_URL no .env)
  --json               imprime o resultado completo em JSON
  --out=<dir>          grava um .json por seed (default .cache/runs)

exemplos:
  npm run recommend -- 802582
  npm run recommend -- 1116833 802582 --json
`);
  process.exit(1);
}

const outDir = flag('out') ?? '.cache/runs';
const verbose = !has('quiet');

const dkk = (n: number) => `${n.toLocaleString('da-DK')} kr`;
const BAND = (b: string) => (b.trim() === '' ? '—' : b.trim());

async function run(sku: string): Promise<RecommendResult> {
  const r = await (
    recommendWorkflow.createRun as () => Promise<{
      start: (a: unknown) => Promise<{ status: string; result?: unknown; error?: unknown }>;
    }>
  )();
  const out = await r.start({
    inputData: {
      sku,
      validateSeed: !has('no-validate-seed') && !has('free'),
      validatePool: !has('no-validate-pool') && !has('free'),
      forceTier: has('retier'),
      verbose,
      ...(flag('webhook') ? { webhookUrl: flag('webhook') } : {}),
    },
  });
  if (out.status !== 'success') {
    // Never JSON.stringify the raw error: a provider error carries the entire
    // request body, which for a tier call is every product name in the
    // category. One readable line is the whole point of an error message.
    const e = out.error as { message?: string; name?: string; statusCode?: number } | undefined;
    const bits = [e?.name, e?.statusCode ? `HTTP ${e.statusCode}` : null, e?.message ?? String(out.status)]
      .filter(Boolean)
      .join(' · ');
    throw new Error(bits);
  }
  return out.result as RecommendResult;
}

mkdirSync(outDir, { recursive: true });

for (const sku of skus) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(`SEED ${sku}`);
  console.log('='.repeat(78));

  let result: RecommendResult;
  try {
    result = await run(sku);
  } catch (error) {
    console.error(`  ! ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  const s = result.seed;
  console.log(`\n  ${s.name}`);
  console.log(`  ${dkk(s.price)}  estoque ${BAND(s.stockBand)}  faixa ${s.tier ?? '—'}  status ${s.status}`);
  console.log(`  ${s.category ?? 'sem categoria'}  |  marca ${s.brand ?? '—'}`);

  const modo = result.mode === 'suggest' ? 'SUGESTAO (semente em estoque)' : 'SUBSTITUICAO (semente sem estoque)';
  console.log(`\n  MODO: ${modo}`);
  if (result.cluster) {
    console.log(`  CLUSTER: ${result.cluster.label} (${result.cluster.id}) — decidido por ${result.cluster.by === 'brand' ? 'marca, sem modelo' : 'modelo'}`);
  }

  if (result.profile) console.log(`  PERFIL: ${result.profile}`);
  if (result.categories.length) {
    console.log(`\n  SECOES ESCOLHIDAS (${result.categories.length})`);
    for (const [i, cat] of result.categories.entries()) {
      console.log(`   ${i + 1}. ${cat.path}`);
      console.log(`      ${cat.reason}`);
    }
  }

  console.log(`\n  DECISAO: ${result.decision}`);
  if (result.noneReason) console.log(`  motivo da recusa: ${result.noneReason}`);

  if (result.picks.length) {
    console.log(`\n  RECOMENDADOS (${result.picks.length})`);
    console.log(`       ${'preco'.padStart(12)}  estoque faixa`);
    for (const p of result.picks) {
      /**
       * What the product is, and what it costs.
       *
       * This column once also carried the price relative to the seed and the
       * discount. Neither decides anything here — what to do with a promotion
       * is a business rule applied later — and both framed the list as cheap
       * or dear when the question is whether the product is right for this
       * customer.
       */
      console.log(
        `   ${String(p.rank).padStart(2)}. ${dkk(p.price).padStart(12)}  ` +
        `${BAND(p.stockBand).padEnd(7)} ${p.tier ?? '—'}  ${p.name.slice(0, 60)}`,
      );
      console.log(`       ${p.reason}`);
    }
  } else {
    console.log('\n  nenhum recomendado.');
  }

  const c = result.cost;
  console.log(`\n  CUSTO DESTE BANNER`);
  console.log(`    chamadas ao modelo : ${c.calls}  (${c.callsAvoidedByCache} evitadas por cache)`);
  console.log(`    tokens             : ${c.inputTokens} entrada + ${c.outputTokens} saida = ${c.totalTokens}`);
  console.log(
    c.priced
      ? `    custo              : USD ${c.usd?.toFixed(6)}`
      : `    custo              : nao precificado — defina GEMINI_PRICE_IN_PER_MTOK e GEMINI_PRICE_OUT_PER_MTOK`,
  );
  console.log(`    tempo em modelo    : ${(c.modelMs / 1000).toFixed(1)}s de ${(result.durationMs / 1000).toFixed(1)}s totais`);
  for (const [stage, b] of Object.entries(c.byStage)) {
    console.log(`      ${stage.padEnd(18)} ${b.calls} chamada(s)  ${b.inputTokens}+${b.outputTokens} tokens`);
  }

  if (Object.keys(result.counts).length) {
    console.log(`\n  CONTAGENS`);
    for (const [k, v] of Object.entries(result.counts)) console.log(`    ${k.padEnd(18)} ${v}`);
  }

  console.log(
    `\n  webhook: ${
      result.webhook.configured
        ? `${result.webhook.delivered} entregues, ${result.webhook.failures.length} falhas`
        : 'nao configurado'
    }`,
  );
  for (const f of result.webhook.failures.slice(0, 3)) console.log(`    ! ${f}`);

  const path = `${outDir}/${sku}-${result.runId}.json`;
  writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(`  resultado: ${path}`);

  if (has('json')) console.log(`\n${JSON.stringify(result, null, 2)}`);
}
