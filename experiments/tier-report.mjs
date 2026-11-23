/**
 * Reads the tier answers pasted back from the model's web UI, joins them with
 * price and stock from our own store, checks whether the tiers hold up, and
 * writes prompt 2 for the seed's tier group.
 *
 * The category is taken from the seed, never hardcoded: the same prompts have
 * to work for a fridge, a phone, a game and a LEGO set.
 *
 * Manual step on purpose: this is a design experiment, not the pipeline. It
 * spends no API tokens.
 *
 *   node experiments/tier-report.mjs <answerCsv> <seedSku>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const TIER_NAME = ['entrada', 'medio', 'premium', 'luxo'];
/**
 * Safety valve only. Candidates are NOT cut by closeness to the seed's price:
 * a cheaper product with the same qualities is a good recommendation, not a
 * worse one, so ranking by price distance would drop exactly the options worth
 * showing. If a tier group ever exceeds this, the cut gets reported rather
 * than applied quietly.
 */
const CEILING = 60;

const answerFile = process.argv[2] ?? 'experiments/01-tier-resposta.csv';
const seedSku = process.argv[3] ?? '802582';

const all = readFileSync('.cache/store/products.ndjson', 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

const seedRaw = all.find((p) => p.sku === seedSku);
if (!seedRaw) { console.error(`seed ${seedSku} nao esta na base`); process.exit(1); }
const categoryPath = seedRaw.category;
if (!categoryPath) { console.error(`seed ${seedSku} nao tem categoria`); process.exit(1); }

const store = new Map(all.filter((p) => p.category === categoryPath).map((p) => [p.sku, p]));
console.log(`categoria : ${categoryPath}  (${store.size} produtos na base)`);

/** Tolerates stray prose, headers and markdown fences around the CSV. */
const tiers = new Map();
const unknown = [];
for (const raw of readFileSync(answerFile, 'utf8').split('\n')) {
  // Skus are not always numeric: the feed has 0A36536, F8J168BT, S3UGI717.
  const m = raw.trim().match(/^"?([A-Za-z0-9]+)"?\s*,\s*([0-3])\s*,\s*(high|low)\b/i);
  if (!m) continue;
  const [, sku, tier, conf] = m;
  if (!store.has(sku)) { unknown.push(sku); continue; }
  tiers.set(sku, { tier: Number(tier), confidence: conf.toLowerCase() });
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const dkk = (n) => `${n.toLocaleString('da-DK')} kr`;

console.log(`respostas lidas   : ${tiers.size}`);
if (unknown.length) console.log(`fora da categoria : ${unknown.length} (${unknown.slice(0, 5).join(', ')})`);

console.log(`\n=== 1. DISTRIBUICAO ===`);
for (let t = 0; t <= 3; t++) {
  const skus = [...tiers].filter(([, v]) => v.tier === t).map(([k]) => k);
  const prices = skus.map((s) => store.get(s).price);
  const low = skus.filter((s) => tiers.get(s).confidence === 'low').length;
  const bar = '#'.repeat(Math.round((skus.length / Math.max(tiers.size, 1)) * 40));
  console.log(
    `  ${t} ${TIER_NAME[t].padEnd(8)} ${String(skus.length).padStart(3)}  ` +
    `mediana ${String(median(prices) ?? '—').padStart(6)}  ` +
    `conf.low ${String(low).padStart(2)}  ${bar}`,
  );
}

/**
 * The real check. The model never saw a price, so if tier medians climb with
 * tier the two signals agree independently. If they do not, the scale is noise.
 */
console.log(`\n=== 2. A FAIXA CORRELACIONA COM PRECO? (modelo nao viu preco) ===`);
const medians = [0, 1, 2, 3].map((t) =>
  median([...tiers].filter(([, v]) => v.tier === t).map(([k]) => store.get(k).price)),
);
const present = medians.map((m, t) => ({ t, m })).filter((x) => x.m !== null);
const monotonic = present.every((x, i) => i === 0 || x.m >= present[i - 1].m);
console.log(`  medianas por faixa : ${medians.map((m) => m ?? '—').join('  ->  ')}`);
console.log(`  monotonica         : ${monotonic ? 'SIM' : 'NAO — a escala nao bate com o mercado'}`);

const pairs = [...tiers].map(([k, v]) => [v.tier, store.get(k).price]);
const rank = (vals) => {
  const idx = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(vals.length);
  for (let i = 0; i < idx.length; i++) r[idx[i][1]] = i + 1;
  return r;
};
const rt = rank(pairs.map((p) => p[0]));
const rp = rank(pairs.map((p) => p[1]));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mt = mean(rt), mp = mean(rp);
const cov = rt.reduce((a, _, i) => a + (rt[i] - mt) * (rp[i] - mp), 0);
const sd = (r, m) => Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0));
console.log(`  Spearman faixa/preco : ${(cov / (sd(rt, mt) * sd(rp, mp))).toFixed(3)}  (n=${pairs.length})`);
console.log(`  leitura: ~0 = faixa e ruido. ~1 = faixa so repete preco, nao`);
console.log(`           acrescenta nada. 0,5-0,8 = concorda e traz eixo novo.`);

console.log(`\n=== 3. ONDE FAIXA E PRECO DISCORDAM (vale ler na mao) ===`);
const odd = [];
for (let t = 0; t <= 3; t++) {
  for (const [sku, v] of [...tiers].filter(([, v]) => v.tier === t)) {
    const p = store.get(sku);
    const closest = present.reduce((a, b) => (Math.abs(b.m - p.price) < Math.abs(a.m - p.price) ? b : a));
    if (Math.abs(closest.t - t) >= 2) odd.push({ t, closest: closest.t, p });
  }
}
if (!odd.length) console.log('  nenhum caso a 2+ faixas de distancia do preco.');
for (const o of odd.slice(0, 12)) {
  console.log(`  faixa ${o.t} mas preco de faixa ${o.closest}  ${dkk(o.p.price).padStart(12)}  ${o.p.name.slice(0, 52)}`);
}

// ---- prompts 2a and 2b ----------------------------------------------------
const seed = store.get(seedSku);
const seedTier = tiers.get(seedSku);
if (!seedTier) { console.log(`\n! seed ${seedSku} sem faixa na resposta`); process.exit(0); }

console.log(`\n=== 4. GRUPO DA SEMENTE ===`);
console.log(`  semente : ${seed.name}`);
console.log(`            ${dkk(seed.price)}  estoque "${seed.stockBand}"  faixa ${seedTier.tier} (${TIER_NAME[seedTier.tier]}, conf ${seedTier.confidence})`);

/** In stock, within `window` tiers of the seed, biggest price first. */
const candidatesWithin = (window) =>
  [...tiers]
    .filter(([sku, v]) =>
      sku !== seedSku &&
      Math.abs(v.tier - seedTier.tier) <= window &&
      store.get(sku).stockBand !== '0')
    .map(([sku]) => ({ ...store.get(sku), tier: tiers.get(sku).tier }))
    .sort((a, b) => b.price - a.price);

const SHARED_RULES = `Think like someone on the shop floor. The customer chose that specific product
and not just anything in the category, and the name is where the reason lives:
the brand, the product line or series, the exact variant, and whatever else the
name spells out. A good substitute honours the reasons that are visible in the
name.

A lower price is not a compromise. If a candidate offers what the customer was
looking at and costs less, that is a better recommendation, not a worse one.
Never rank a product down for being cheaper, and never rank one up for costing
about the same as what the customer wanted.

Work only from what the names and the prices actually say. Do not assume
anything that is not written there.

Rank the candidates you would actually put in front of this customer. Include
only the ones you would genuinely offer. If a candidate would be a bad
substitute, leave it out rather than ranking it low.

For each one, give ONE short sentence saying why, naming the specific thing it
shares with the product the customer wanted, or the specific trade-off you are
offering. "Similar price" is not a reason. If the real reason is a compromise,
say so plainly: a salesperson who oversells loses the sale.

Answer with JSON and nothing else. No prose before or after, no code fence.

  {"picks": [{"item": 3, "reason": "..."}, {"item": 1, "reason": "..."}],
   "noneReason": null}

- \`item\` is the product's NUMBER in the list below. Never a name, never a code.
- The order of \`picks\` is the ranking: best first. There is no rank field.
- If NONE of them is a reasonable substitute, return \`"picks": []\` and put the
  explanation in \`noneReason\`. An empty list is how you say no.
- When you do recommend something, \`noneReason\` is null.`;

const opening = `You are an experienced salesperson at Elgiganten, a Nordic electronics and
appliance retailer. You know this catalogue and you know how to read what
someone wants from what they were looking at.

Category: ${categoryPath}

A customer was looking at this product, but it is out of stock:

  ${seed.name}
  ${seed.price} kr`;

function write(file, title, note, intro, list, withTier) {
  const cut = list.length > CEILING;
  if (cut) console.log(`  ! ${file}: ${list.length} candidatos, acima do teto de ${CEILING}`);
  // No discount, no previous price: what to do with a promotion is a business
  // rule, decided after the model has chosen on merit.
  //
  // Items are numbered and the sku is withheld. The model answers with the
  // number, so it cannot name a product that is not on the list, and an
  // out-of-range number is a detectable error rather than a plausible lie.
  const offered = list.slice(0, CEILING);
  const lines = offered.map((p, i) =>
    `${String(i + 1).padStart(2)}  ${p.name}  —  ${p.price} kr${withTier ? `  —  tier ${p.tier}` : ''}`);
  writeFileSync(`experiments/${file}`, `# ${title}

Gerado por \`tier-report.mjs\`. Categoria \`${categoryPath}\`.
Semente: ${seed.name} (${dkk(seed.price)}, estoque "${seed.stockBand}", faixa ${seedTier.tier}).
${note}

Ordenado por preço, do maior para o menor. Não há corte por proximidade de
preço: mais barato pelo mesmo produto é vantagem, não defeito.

A resposta é JSON, e o modelo devolve o NÚMERO do item, não o sku. O mapa
número → sku está no arquivo \`-indice.json\` ao lado deste.

Schema para quando isso virar chamada de API:

    z.object({
      picks: z.array(z.object({
        item: z.number().int().min(1),
        reason: z.string(),
      })),
      noneReason: z.string().nullable(),
    })

\`picks\` vazio é a recusa — o workflow testa \`picks.length === 0\` e não precisa
interpretar texto nenhum. \`noneReason\` só vai para log, nunca para decisão.

Cole tudo daqui para baixo.

---

${opening}

${intro}

${SHARED_RULES}

Candidates:

${lines.join('\n')}
`);
  writeFileSync(
    `experiments/${file.replace(/\.md$/, '-indice.json')}`,
    JSON.stringify(offered.map((p, i) => ({ item: i + 1, sku: p.sku, name: p.name, price: p.price, tier: p.tier })), null, 2),
  );
  console.log(`  ${file}  —  ${lines.length} candidatos (indice em ${file.replace(/\.md$/, '-indice.json')})`);
}

const same = candidatesWithin(0);
console.log(`\n  PASSADA 1 — mesma faixa, em estoque : ${same.length}`);
if (!same.length) {
  console.log(`  ! nada da mesma faixa em estoque. Vai direto para a passada 2.`);
} else {
  write(
    '02a-recomendar-mesma-faixa.md',
    'Prompt 2a — mesma faixa',
    `Candidatos: ${same.length} da mesma faixa (${seedTier.tier}), em estoque.`,
    `Below are products we DO have in stock, from the same category. All of them sit
at the same premium tier as the product the customer wanted, judged separately
from price. Recommend what to show this customer instead, ranked best first.`,
    same,
    false,
  );
}

const wider = candidatesWithin(1);
const added = wider.length - same.length;
console.log(`\n  PASSADA 2 — faixa +-1, em estoque   : ${wider.length}  (+${added})`);
write(
  '02b-recomendar-mais-um.md',
  'Prompt 2b — faixa ±1 (só se a 2a voltar sem nada)',
  `Candidatos: ${wider.length} entre as faixas ${Math.max(0, seedTier.tier - 1)} e ${Math.min(3, seedTier.tier + 1)}, em estoque. ${added} a mais que a passada 1.`,
  `Below are products we DO have in stock, from the same category. Each carries a
premium tier from 0 (entry) to 3 (luxury), judged separately from its price.
The product the customer wanted is tier ${seedTier.tier}.

Nothing at exactly that tier was a reasonable substitute, so this list also
includes the tier above and below. A product that matches what the customer was
actually looking at can be the better recommendation even at a different tier.
Weigh tier as one signal among what the names tell you, not as a rule.

Recommend what to show this customer instead, ranked best first.`,
  wider,
  true,
);
