/**
 * Lists recommendation runs from Mastra's own storage.
 *
 * This exists to prove the point of configuring storage: the run history
 * outlives the process, and it is read back through the library rather than by
 * poking at the SQLite file. It is also the shape the front end will want —
 * yesterday's runs, not only the one in flight.
 *
 *   npm run runs                 last 10 recommendation runs
 *   npm run runs -- --limit=25
 *   npm run runs -- <runId>      the full stage timeline of one run
 */
import { mastra } from '../mastra/index.js';

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice(8) ?? 10);
const wantedRunId = args.find((a) => !a.startsWith('--'));

const storage = mastra.getStorage();
if (!storage) {
  console.error('sem storage configurado na instancia do Mastra');
  process.exit(1);
}
const workflows = await storage.getStore('workflows');
if (!workflows) {
  console.error('dominio de workflows indisponivel no storage');
  process.exit(1);
}

const { runs, total } = await workflows.listWorkflowRuns({
  workflowName: 'recommend',
  perPage: wantedRunId ? 100 : limit,
  page: 0,
});

if (!runs.length) {
  console.log('nenhuma execucao gravada ainda — rode `npm run recommend -- <sku>` primeiro');
  process.exit(0);
}

type Out = {
  decision?: string;
  seed?: { sku?: string; name?: string; price?: number };
  picks?: Array<{ rank: number; price: number; name: string; reason: string }>;
  cost?: { calls?: number; totalTokens?: number; usd?: number | null };
  timeline?: Array<{ seq: number; stage: string; elapsedMs: number; data: Record<string, unknown> }>;
  durationMs?: number;
};

const outputOf = (run: { snapshot?: unknown }): Out => {
  const snap = run.snapshot as { context?: Record<string, { output?: Out }> } | string | undefined;
  if (!snap || typeof snap === 'string') return {};
  return snap.context?.finish?.output ?? {};
};

if (wantedRunId) {
  const run = runs.find((r) => r.runId === wantedRunId);
  if (!run) {
    console.error(`run ${wantedRunId} nao encontrada nas ultimas ${runs.length}`);
    process.exit(1);
  }
  const o = outputOf(run);
  console.log(`run ${run.runId}`);
  console.log(`  ${o.seed?.name ?? '—'}`);
  console.log(`  decisao ${o.decision ?? '—'}  |  ${o.cost?.calls ?? 0} chamadas  |  ${o.cost?.totalTokens ?? 0} tokens\n`);
  for (const e of o.timeline ?? []) {
    const detail = Object.entries(e.data)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' ');
    console.log(`  [${String(e.elapsedMs).padStart(6)}ms] ${e.stage.padEnd(24)} ${detail}`);
  }
  for (const p of o.picks ?? []) console.log(`\n  #${p.rank} ${p.price} kr  ${p.name}\n     ${p.reason}`);
  process.exit(0);
}

console.log(`${runs.length} de ${total} execucoes de \`recommend\` gravadas\n`);
console.log(`  ${'runId'.padEnd(38)} ${'decisao'.padEnd(16)} ${'chamadas'.padStart(8)} ${'tokens'.padStart(7)}  semente`);
for (const run of runs) {
  const o = outputOf(run);
  console.log(
    `  ${run.runId.padEnd(38)} ${(o.decision ?? '—').padEnd(16)} ` +
    `${String(o.cost?.calls ?? 0).padStart(8)} ${String(o.cost?.totalTokens ?? 0).padStart(7)}  ` +
    `${o.seed?.sku ?? '—'} ${(o.seed?.name ?? '').slice(0, 40)}`,
  );
}
console.log(`\ndetalhe de uma: npm run runs -- ${runs[0]?.runId}`);
