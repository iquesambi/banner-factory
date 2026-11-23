/**
 * Turns saved runs into a review document.
 *
 * The point is to be judged by a human: every recommendation is printed with
 * the reason the model gave for it, and there is a column to write a verdict
 * in. Quality of choice has no automatic metric here — the criterion is what
 * the business considers a good substitute, which is not mine to assert.
 *
 *   npm run report                      every run in .cache/runs
 *   npm run report -- --out=docs/x.md
 *   npm run report -- --runs=.cache/runs-2
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RecommendResult } from '../mastra/workflows/recommend.js';

const args = process.argv.slice(2);
const outPath = args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'docs/teste-sementes.md';
/** A markdown file dropped in after the header, for context the runs cannot carry. */
const notePath = args.find((a) => a.startsWith('--note='))?.slice(7);
/**
 * Which run directory to report on. A test round written to its own directory
 * with `recommend --out=` reports on its own, instead of being merged with
 * every earlier round.
 */
const dir = args.find((a) => a.startsWith('--runs='))?.slice(7) ?? '.cache/runs';

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
if (!files.length) {
  console.error(`sem execucoes em ${dir} — rode \`npm run recommend -- <sku>\` primeiro`);
  process.exit(1);
}

/** One row per seed: the newest run wins, so a re-run replaces an older one. */
const latest = new Map<string, { result: RecommendResult; mtime: number }>();
for (const f of files) {
  const result = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as RecommendResult;
  const mtime = Number(f.match(/run_([a-z0-9]+)_/)?.[1] ? parseInt(f.split('run_')[1]!.split('_')[0]!, 36) : 0);
  const prev = latest.get(result.seed.sku);
  if (!prev || mtime >= prev.mtime) latest.set(result.seed.sku, { result, mtime });
}

const runs = [...latest.values()].map((v) => v.result).sort((a, b) => a.seed.sku.localeCompare(b.seed.sku));
const dkk = (n: number) => `${n.toLocaleString('da-DK')} kr`;
const band = (b: string) => (b.trim() === '' || b.trim() === '0' ? 'esgotado' : b.trim());
const delta = (p: number, seed: number) => (seed ? `${p > seed ? '+' : ''}${(((p - seed) / seed) * 100).toFixed(0)}%` : '—');

const lines: string[] = [];
lines.push('# Teste de recomendação — sementes para avaliar');
lines.push('');
lines.push('Cada seção é uma semente esgotada e o que o fluxo recomendou, com a');
lines.push('justificativa que o modelo deu. A coluna **Vale?** é para você preencher.');
lines.push('');
lines.push('Gerado por `npm run report`. Os dados brutos de cada execução estão em');
lines.push('`.cache/runs/`.');
lines.push('');
if (notePath) {
  lines.push(readFileSync(notePath, 'utf8').trim());
  lines.push('');
}
lines.push('## Resumo');
lines.push('');
lines.push('| sku | semente | preço | decisão | nº | 1ª recomendação | chamadas | tokens |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const r of runs) {
  const first = r.picks[0];
  lines.push(
    `| \`${r.seed.sku}\` | ${r.seed.name.slice(0, 34)} | ${dkk(r.seed.price)} | \`${r.decision}\` | ` +
    `${r.picks.length} | ${first ? `${first.name.slice(0, 30)} (${delta(first.price, r.seed.price)})` : '—'} | ` +
    `${r.cost.calls} | ${r.cost.totalTokens} |`,
  );
}
lines.push('');

const totals = runs.reduce(
  (a, r) => ({
    calls: a.calls + r.cost.calls,
    tokens: a.tokens + r.cost.totalTokens,
    saved: a.saved + r.cost.callsAvoidedByCache,
    withPicks: a.withPicks + (r.picks.length ? 1 : 0),
  }),
  { calls: 0, tokens: 0, saved: 0, withPicks: 0 },
);
lines.push(
  `${runs.length} sementes · ${totals.withPicks} com recomendação · ` +
  `${totals.calls} chamadas · ${totals.tokens} tokens · ${totals.saved} chamadas evitadas por cache`,
);
lines.push('');
lines.push('---');
lines.push('');

for (const r of runs) {
  lines.push(`## \`${r.seed.sku}\` — ${r.seed.name}`);
  lines.push('');
  lines.push(`- **${dkk(r.seed.price)}**, estoque ${band(r.seed.stockBand)}, faixa ${r.seed.tier ?? '—'}`);
  lines.push(`- categoria \`${r.seed.category ?? 'sem categoria'}\`, marca ${r.seed.brand ?? '—'}`);
  lines.push(`- decisão **\`${r.decision}\`** · ${r.cost.calls} chamadas · ${r.cost.totalTokens} tokens · ${(r.durationMs / 1000).toFixed(0)}s`);
  lines.push('');
  if (r.noneReason) {
    lines.push(`> **Sem recomendação.** ${r.noneReason}`);
    lines.push('');
  }
  if (r.picks.length) {
    lines.push('| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const p of r.picks) {
      lines.push(
        `| ${p.rank} | ${p.name} | ${dkk(p.price)} | ${delta(p.price, r.seed.price)} | ` +
        `${band(p.stockBand)} | ${p.tier ?? '—'} | ${p.reason} |  |`,
      );
    }
    lines.push('');
  }
  const stages = r.timeline
    .filter((e) => !['run.started', 'seed.loaded', 'run.completed'].includes(e.stage))
    .map((e) => e.stage)
    .join(' → ');
  lines.push(`<sub>etapas: ${stages}</sub>`);
  lines.push('');
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`${outPath}  —  ${runs.length} sementes, ${totals.withPicks} com recomendação`);
