/**
 * The whole chain, end to end: a seed goes in, a brief for the art director
 * comes out.
 *
 *   npm run brief -- 802582
 *   npm run brief -- 802582 --lang=sv --pick=2
 *   npm run brief -- 802582 --json
 *
 * Two workflows run back to back. `recommend` decides WHICH product the banner
 * is for; `compose` writes the copy and chooses the badges. This file only
 * joins them and lays the result out, which is deliberate — when there is a
 * front end, it will make the same two calls.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { recommendWorkflow, composeWorkflow } from '../mastra/index.js';
import type { RecommendResult } from '../mastra/workflows/recommend.js';
import type { ComposeResult } from '../mastra/workflows/compose.js';
import { buildBrief, priceText, type ArtDirectorBrief } from '../banner/brief.js';
import type { Language } from '../banner/facts.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => args.includes(`--${name}`);

const skus = args.filter((a) => !a.startsWith('--'));
if (!skus.length) {
  console.error(`uso: npm run brief -- <seed-sku> [seed-sku...] [opcoes]

  --lang=<da|sv|en>   idioma do banner (default da)
  --pick=<n>          qual recomendacao usar (default 1, a melhor)
  --no-validate-pool  pula a limpeza de categoria (mais rapido)
  --quiet             nao imprime a timeline ao vivo
  --json              imprime o briefing completo em JSON
  --out=<dir>         grava um .json por briefing (default .cache/briefs)

exemplo:
  npm run brief -- 802582 --no-validate-pool
`);
  process.exit(1);
}

const LANGS: Language[] = ['da', 'sv', 'en'];
const language = (flag('lang') ?? 'da') as Language;
if (!LANGS.includes(language)) {
  console.error(`idioma desconhecido: ${language} (use da, sv ou en)`);
  process.exit(1);
}
const pickIndex = Number(flag('pick') ?? '1');
const outDir = flag('out') ?? '.cache/briefs';
const verbose = !has('quiet');

async function start<T>(workflow: { createRun: unknown }, inputData: unknown, label: string): Promise<T> {
  const r = await (
    workflow.createRun as () => Promise<{
      start: (a: unknown) => Promise<{ status: string; result?: unknown; error?: unknown }>;
    }>
  )();
  const out = await r.start({ inputData });
  if (out.status !== 'success') {
    // Never stringify the raw provider error: it carries the whole request body.
    const e = out.error as { message?: string; name?: string; statusCode?: number } | undefined;
    const bits = [e?.name, e?.statusCode ? `HTTP ${e.statusCode}` : null, e?.message ?? String(out.status)]
      .filter(Boolean)
      .join(' · ');
    throw new Error(`${label}: ${bits}`);
  }
  return out.result as T;
}

const rule = (s = '') => console.log(`\n${s}${'─'.repeat(Math.max(0, 76 - s.length))}`);

function print(brief: ArtDirectorBrief, rec: RecommendResult, comp: ComposeResult) {
  console.log(`\n${'█'.repeat(76)}`);
  console.log(`  BRIEFING PARA O DIRETOR DE ARTE`);
  console.log(`  ${brief.canvas.width} × ${brief.canvas.height} · idioma ${brief.language}`);
  console.log('█'.repeat(76));

  rule('O QUE ACONTECEU ');
  console.log(`  o cliente viu    ${brief.seed.name}`);
  console.log(`                   ${brief.seed.sku} · ${priceText(brief.seed.price)} · estoque ${brief.seed.stockBand || '0'}`);
  console.log(`  ${brief.seed.unavailable ? 'esgotou, entao' : 'segue disponivel'}`);
  console.log(`  o banner mostra  ${brief.product.name}`);
  console.log(`                   ${brief.product.sku} · ${brief.product.priceText}`);
  console.log(`  por que          ${brief.chosenBecause}`);
  console.log(`  caminho          ${brief.decision}`);

  rule('TEXTO ');
  const { headline, accent, support, cta } = brief.copy;
  const marked = accent && headline.includes(accent)
    ? headline.replace(accent, `«${accent}»`)
    : headline;
  console.log(`  TITULO     ${marked}`);
  console.log(`             ${headline.length} caracteres · «...» vai no verde ${brief.design.palette.green}`);
  console.log(`  APOIO      ${support}`);
  console.log(`  BOTAO      ${cta}`);
  if (brief.finePrint) console.log(`  LETRA MIUDA ${brief.finePrint}`);

  rule('SELOS ');
  if (brief.badges.length) {
    brief.badges.forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.kind} — ${b.value}`);
      console.log(`     desenho: ${b.treatment}`);
      console.log(`     motivo:  ${b.reason}`);
    });
  } else {
    console.log('  nenhum — o produto se vende pelo que e');
  }

  if (brief.mustNotContradict.length) {
    rule('NAO PODE CONTRADIZER ');
    for (const r of brief.mustNotContradict) console.log(`  · ${r}`);
  }

  rule('IMAGEM DO PRODUTO ');
  console.log(`  ${brief.product.image}`);

  rule('ARTE ');
  const p = brief.design.palette;
  console.log(`  fundo      ${brief.design.background}`);
  console.log(`  verde      ${p.green}      titulo em destaque e botao`);
  console.log(`  rosa       ${p.pink}      circulo`);
  console.log(`  amarelo    ${p.yellow}      barra`);
  console.log(`  branco     ${p.white}      texto`);
  console.log(`  titulo     ${brief.design.fonts.headline.family}`);
  console.log(`  corpo      ${brief.design.fonts.body.family}`);
  console.log(`  logo       ${brief.design.logo.onNavy}`);
  const z = brief.design.zones;
  console.log(`  faixas     texto x${z.text.x}+${z.text.width} · produto x${z.product.x}+${z.product.width} · lateral x${z.side.x}+${z.side.width}`);
  for (const n of brief.design.notes) console.log(`  · ${n}`);

  if (comp.copyIssues.length) {
    rule('A CHECAGEM REPROVOU, NO CAMINHO ');
    for (const i of comp.copyIssues) console.log(`  · ${i}`);
  }

  rule('CUSTO ');
  const calls = rec.cost.calls + comp.cost.calls;
  const tokens = rec.cost.totalTokens + comp.cost.inputTokens + comp.cost.outputTokens;
  console.log(`  escolher o produto  ${rec.cost.calls} chamada(s) · ${rec.cost.totalTokens} tokens`);
  console.log(`  escrever e decidir  ${comp.cost.calls} chamada(s) · ${comp.cost.inputTokens + comp.cost.outputTokens} tokens`);
  console.log(`  total               ${calls} chamada(s) · ${tokens} tokens`);
  if (rec.cost.callsAvoidedByCache) {
    console.log(`  evitadas por cache  ${rec.cost.callsAvoidedByCache}`);
  }
}

let failed = 0;
const briefs: ArtDirectorBrief[] = [];

for (const seedSku of skus) {
  try {
    if (verbose) console.log(`\n── escolhendo o produto para ${seedSku} ${'─'.repeat(40)}`);
    const rec = await start<RecommendResult>(
      recommendWorkflow,
      {
        sku: seedSku,
        validateSeed: !has('no-validate-seed'),
        validatePool: !has('no-validate-pool'),
        verbose,
      },
      'recommend',
    );

    /**
     * When the seed is itself in stock the recommender answers with it, so the
     * banner is for the product the customer was already looking at. Both
     * cases land in `picks`, which is why nothing special happens here.
     */
    const pick = rec.picks[pickIndex - 1];
    if (!pick) {
      console.error(
        `\n${seedSku}: sem recomendacao${rec.noneReason ? ` — ${rec.noneReason}` : ''}, nao da para fazer banner`,
      );
      failed++;
      continue;
    }

    if (verbose) console.log(`\n── escrevendo o banner de ${pick.sku} ${'─'.repeat(42)}`);
    const comp = await start<ComposeResult>(
      composeWorkflow,
      { sku: pick.sku, language, verbose },
      'compose',
    );

    if (!comp.copy) {
      console.error(`\n${seedSku}: a copy nao passou na checagem, sem briefing`);
      failed++;
      continue;
    }

    const brief = buildBrief({
      language,
      seed: {
        sku: rec.seed.sku,
        name: rec.seed.name,
        price: rec.seed.price,
        stockBand: rec.seed.stockBand,
      },
      decision: rec.decision,
      chosenBecause: pick.reason,
      facts: comp.facts,
      copy: comp.copy,
      show: comp.show,
      finePrint: comp.finePrint,
    });

    briefs.push(brief);
    print(brief, rec, comp);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      `${outDir}/${seedSku}-${pick.sku}-${language}.json`,
      JSON.stringify(brief, null, 2),
    );
    console.log(`\n  gravado em ${outDir}/${seedSku}-${pick.sku}-${language}.json`);
  } catch (error) {
    failed++;
    console.error(`\n${seedSku}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (has('json')) console.log(JSON.stringify(briefs, null, 2));
if (failed) process.exit(1);
