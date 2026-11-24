import { TagStore } from '../store/index.js';
import { publishProducts, reconcilePublished } from '../store/firestore-products.js';
import { credentialKind, projectId, storageBucket } from '../firebase/admin.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => args.includes(`--${name}`);

if (has('help')) {
  console.error(`uso: npm run publish -- [opcoes]

Publica a tabela de produtos (o banco do marketing) no Firestore.
O id do documento e o SKU, que e o de-para com o feed.

  --dry            so conta o que iria, nao escreve nada
  --limit=<n>      no maximo n documentos nesta rodada
  --skus=a,b,c     publica so esses SKUs
  --force          reescreve tambem o que ja esta publicado igual
  --reconcile      le os ids que ja existem la e marca como publicados aqui
  --store=<dir>    outro diretorio de store

credencial de servidor, em ordem de preferencia:
  FIREBASE_SERVICE_ACCOUNT        o JSON inteiro, para um ambiente publicado
  GOOGLE_APPLICATION_CREDENTIALS  caminho do arquivo de chave, para esta maquina
`);
  process.exit(0);
}

const store = new TagStore(flag('store')).load();
const only = flag('skus')?.split(',').map((s) => s.trim()).filter(Boolean);

console.log(`projeto     : ${projectId() ?? '— nenhum no ambiente —'}`);
console.log(`credencial  : ${credentialKind()}`);
console.log(`bucket      : ${storageBucket() ?? '—'}`);
console.log(`catalogo    : ${store.size} produtos, ${store.enrichment.size} com enriquecimento`);

const pending = store.enrichment.pendingPublish();
console.log(`a publicar  : ${only ? only.length : pending.length}  (do que falta no espelho)`);

if (has('dry')) {
  console.log('\nmodo seco: nada foi escrito.');
  console.log(`como cada categoria foi decidida: ${JSON.stringify(store.enrichment.decidedCounts())}`);
  process.exit(0);
}

if (has('reconcile')) {
  const stamped = await reconcilePublished(store);
  const meta0 = store.metadata;
  if (meta0) store.save(meta0);
  console.log(`\nreconciliado: ${stamped} documentos ja existiam la e foram marcados aqui`);
  console.log(`ainda falta : ${store.enrichment.pendingPublish().length}`);
  process.exit(0);
}

const limit = flag('limit') ? Number(flag('limit')) : undefined;
const report = await publishProducts(store, {
  ...(only ? { only } : {}),
  ...(limit !== undefined ? { limit } : {}),
  force: has('force'),
  onProgress: (written, total) => {
    process.stdout.write(`\r  escrevendo ${written}/${total}`);
  },
});
process.stdout.write('\r');

if (report.unavailable) {
  console.error(`\nnada publicado: ${report.unavailable}`);
  console.error('rode com --dry para conferir o que iria, ou configure a credencial.');
  process.exit(1);
}

console.log(`\nescritos    : ${report.written}`);
console.log(`pulados     : ${report.skipped}  (SKU que nao esta mais no feed)`);

// Os carimbos de publicacao sao estado local e precisam sobreviver a rodada.
const meta = store.metadata;
if (meta) store.save(meta);
console.log(`ainda falta : ${store.enrichment.pendingPublish().length}`);
