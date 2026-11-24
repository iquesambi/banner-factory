import { loadTaxonomy } from '../taxonomy/index.js';
import { TagStore } from '../store/index.js';
import { enrichCategories, type Pass } from '../tagger/enrich.js';
import { hasApiKey } from '../mastra/agents/category-validator.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => args.includes(`--${name}`);

if (has('help')) {
  console.error(`uso: npm run enrich -- [opcoes]

Da categoria aos produtos que as regras nao resolveram sozinhas.

  --dry                so conta os tres grupos, nao chama modelo nenhum
  --limit=<n>          no maximo n produtos nesta rodada
  --passes=a,b         quais etapas rodar. padrao: ask.
                       confirm e choose existem aqui, mas normalmente nao se
                       usam: o que a regra achou por sufixo e confirmado sob
                       demanda, quando a categoria aparece numa run.
  --batch=<n>          produtos por chamada (padrao 60)
  --redo               pergunta de novo o que um modelo ja decidiu
  --no-publish         nao espelha para o Firestore enquanto roda
  --store=<dir>        outro diretorio de store

exemplos:
  npm run enrich -- --dry
  npm run enrich -- --limit=120
  npm run enrich -- --passes=ask --limit=600
`);
  process.exit(0);
}

const dryRun = has('dry');
if (!dryRun && !hasApiKey()) {
  console.error('sem GOOGLE_GENERATIVE_AI_API_KEY no ambiente. use --dry para so contar.');
  process.exit(1);
}

const taxonomy = loadTaxonomy();
const store = new TagStore(flag('store')).load();

const passes = flag('passes')
  ?.split(',')
  .map((p) => p.trim())
  .filter((p): p is Pass => p === 'confirm' || p === 'choose' || p === 'ask');

const limit = flag('limit') ? Number(flag('limit')) : undefined;
const batch = flag('batch') ? Number(flag('batch')) : undefined;

console.log(`catalogo: ${store.size} produtos`);
if (dryRun) console.log('modo seco: nenhuma chamada sera feita\n');

let lastNote = '';
const report = await enrichCategories(store, taxonomy, {
  ...(passes?.length ? { passes } : {}),
  ...(limit !== undefined ? { limit } : {}),
  ...(batch !== undefined ? { batch } : {}),
  redo: has('redo'),
  publish: !has('no-publish'),
  dryRun,
  onProgress: (note) => {
    if (note === lastNote) return;
    lastNote = note;
    console.log(`  ${note}`);
  },
});

const pct = (n: number) => `${((n / store.size) * 100).toFixed(1)}%`;

console.log(`
COMO O CATALOGO SE DIVIDE
  encaixe perfeito, de graca   ${String(report.buckets.perfect).padStart(6)}  ${pct(report.buckets.perfect)}
  achou algo, mas por sufixo   ${String(report.buckets.imperfect).padStart(6)}  ${pct(report.buckets.imperfect)}
  nao achou nada               ${String(report.buckets.none).padStart(6)}  ${pct(report.buckets.none)}

  o grupo do meio nao e perguntado aqui. fica com a categoria que a regra deu,
  marcado como imperfeito, e leva um sim-ou-nao quando a categoria aparecer
  numa run de verdade.`);

if (dryRun) {
  const perCall = Number(flag('batch') ?? 60);
  const calls = Math.ceil(report.buckets.none / perCall);
  console.log(`\n  esta rodada: ~${calls} chamadas em lotes de ${perCall}`);
  console.log(`  adiado para quando a categoria aparecer: ${report.buckets.imperfect} produtos`);
  process.exit(0);
}

console.log(`
O QUE O MODELO DECIDIU
  confirmou o palpite da regra ${String(report.confirmed).padStart(6)}
  recusou o palpite            ${String(report.rejected).padStart(6)}
  corrigiu escolhendo outra    ${String(report.chosen).padStart(6)}
  perguntado abertamente       ${String(report.asked).padStart(6)}
    virou categoria            ${String(report.resolvedByAsking).padStart(6)}
    nao casou com a arvore     ${String(report.unresolvedAfterAsking).padStart(6)}
  seguiu sem categoria         ${String(report.stillNone).padStart(6)}

ESPELHO NO FIRESTORE
  documentos publicados        ${String(report.published).padStart(6)}${
  report.publishSkipped ? `\n  nao publicado                ${report.publishSkipped}` : ''
}

CUSTO
  chamadas                     ${String(report.calls).padStart(6)}
  tokens                       ${report.inputTokens} entrada + ${report.outputTokens} saida
  custo                        ${report.usd === null ? 'nao precificado' : `USD ${report.usd.toFixed(6)}`}`);

if (report.unmatchedAnswers.length) {
  /**
   * The most useful output of the whole run. Every line here is a word the
   * model uses for a real product that the taxonomy has no term for — which
   * is a synonym worth adding, not a failure worth hiding.
   */
  console.log(`\nO MODELO DISSE, MAS A ARVORE NAO RECONHECEU (${report.unmatchedAnswers.length} mostrados)`);
  console.log('  cada linha aqui e um sinonimo que vale a pena adicionar a taxonomia');
  for (const u of report.unmatchedAnswers) {
    console.log(`   "${u.answer}"`.padEnd(28) + u.name.slice(0, 52));
  }
}

const meta = store.metadata;
if (meta) {
  store.save(meta);
  console.log(`\ngravado no banco do marketing: ${store.enrichment.size} registros`);
  console.log(`como cada categoria foi decidida: ${JSON.stringify(store.enrichment.decidedCounts())}`);
}
