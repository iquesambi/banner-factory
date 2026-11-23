/**
 * Writes the copy and the strategy for one product, in one language.
 *
 *   npm run compose -- 802582
 *   npm run compose -- 802582 --lang=sv
 *   npm run compose -- 802582 --lang=da --lang=sv --lang=en
 *
 * Takes a SKU directly rather than a seed, because the recommender's job ends
 * when it names a product and this one begins there. Chaining the two is the
 * front end's job, and until there is one, running them separately is also how
 * you look at one without paying for the other.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { composeWorkflow } from '../mastra/index.js';
import type { ComposeResult } from '../mastra/workflows/compose.js';
import type { Language } from '../banner/facts.js';

const args = process.argv.slice(2);
const flags = (name: string) =>
  args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const flag = (name: string) => flags(name)[0];
const has = (name: string) => args.includes(`--${name}`);

const skus = args.filter((a) => !a.startsWith('--'));
if (!skus.length) {
  console.error(`uso: npm run compose -- <sku> [sku...] [opcoes]

  --lang=<da|sv|en>  idioma do banner (default da; pode repetir)
  --quiet            nao imprime a timeline ao vivo
  --webhook=<url>    POST de cada evento (ou BANNER_WEBHOOK_URL no .env)
  --json             imprime o resultado completo em JSON
  --out=<dir>        grava um .json por banner (default .cache/copy)

exemplos:
  npm run compose -- 802582
  npm run compose -- 881547 --lang=da --lang=sv --lang=en
`);
  process.exit(1);
}

const LANGS = ['da', 'sv', 'en'] as const;
const picked = flags('lang');
for (const l of picked) {
  if (!LANGS.includes(l as Language)) {
    console.error(`idioma desconhecido: ${l} (use da, sv ou en)`);
    process.exit(1);
  }
}
const languages: Language[] = picked.length ? (picked as Language[]) : ['da'];
const outDir = flag('out') ?? '.cache/copy';
const verbose = !has('quiet');
const dkk = (n: number) => `${n.toLocaleString('da-DK')} kr`;

async function run(sku: string, language: Language): Promise<ComposeResult> {
  const r = await (
    composeWorkflow.createRun as () => Promise<{
      start: (a: unknown) => Promise<{ status: string; result?: unknown; error?: unknown }>;
    }>
  )();
  const out = await r.start({
    inputData: {
      sku,
      language,
      verbose,
      ...(flag('webhook') ? { webhookUrl: flag('webhook') } : {}),
    },
  });
  if (out.status !== 'success') {
    // One readable line, never the raw provider error: it carries the request body.
    const e = out.error as { message?: string; name?: string; statusCode?: number } | undefined;
    const bits = [e?.name, e?.statusCode ? `HTTP ${e.statusCode}` : null, e?.message ?? String(out.status)]
      .filter(Boolean)
      .join(' · ');
    throw new Error(bits);
  }
  return out.result as ComposeResult;
}

function report(r: ComposeResult) {
  const f = r.facts;
  console.log(`\n${'='.repeat(74)}`);
  console.log(`${f.name}`);
  console.log(`${f.sku} · ${dkk(f.price)} · ${f.language}`);
  console.log('='.repeat(74));

  if (r.copy) {
    const { headline, accent, support, cta } = r.copy;
    // The accent is shown in brackets: it is the phrase that goes green.
    const marked = accent && headline.includes(accent)
      ? headline.replace(accent, `[${accent}]`)
      : headline;
    console.log(`\n  TITULO     ${marked}`);
    console.log(`             ${headline.length} caracteres`);
    console.log(`  SUBTITULO  ${support}`);
    console.log(`  BOTAO      ${cta}`);
    console.log(`\n  porque     ${r.copy.rationale}`);
  } else {
    console.log('\n  sem copy');
  }

  if (r.copyIssues.length) {
    console.log('\n  problemas encontrados pela checagem:');
    for (const i of r.copyIssues) console.log(`    · ${i}`);
  }

  console.log('\n  SELOS');
  if (r.show.length) {
    r.show.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.badge.kind} — ${s.badge.value}`);
      console.log(`       ${s.reason}`);
    });
  } else {
    console.log('    nenhum');
  }

  if (r.skip.length) {
    console.log('\n  deixados de fora:');
    for (const s of r.skip) console.log(`    · ${s.badge.kind} — ${s.reason}`);
  }

  if (f.blocked.length) {
    console.log('\n  bloqueados pela verdade do feed:');
    for (const b of f.blocked) console.log(`    · ${b.kind} — ${b.why}`);
  }

  if (f.restrictions.length) {
    console.log('\n  condicoes do produto:');
    for (const c of f.restrictions) console.log(`    · ${c}`);
  }

  if (r.finePrint) console.log(`\n  LETRA MIUDA  ${r.finePrint}`);

  const c = r.cost;
  const usd = c.usd === null ? 'sem preco configurado' : `$${c.usd.toFixed(6)}`;
  console.log(`\n  custo: ${c.calls} chamada(s) · ${c.inputTokens + c.outputTokens} tokens · ${usd}`);
}

const results: ComposeResult[] = [];
let failed = 0;

for (const sku of skus) {
  for (const language of languages) {
    try {
      const r = await run(sku, language);
      results.push(r);
      report(r);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/${sku}-${language}-${r.runId}.json`, JSON.stringify(r, null, 2));
    } catch (error) {
      failed++;
      console.error(`\n${sku} (${language}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (has('json')) console.log(JSON.stringify(results, null, 2));

const totalCalls = results.reduce((a, r) => a + r.cost.calls, 0);
const totalTokens = results.reduce((a, r) => a + r.cost.inputTokens + r.cost.outputTokens, 0);
console.log(
  `\n${results.length} banner(s), ${failed} falha(s) · ${totalCalls} chamadas · ${totalTokens} tokens`,
);
if (failed) process.exit(1);
