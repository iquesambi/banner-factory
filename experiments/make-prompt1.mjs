/**
 * Writes the tier-classification prompt for ANY category.
 *
 * Nothing about a specific kind of product may appear in the prompt text: the
 * same wording has to work for a fridge, a phone, a game and a LEGO set. The
 * only thing injected is the category path, which the model reads directly.
 *
 *   node experiments/make-prompt1.mjs <categoryPath> [seedSku...]
 *
 * Products included: everything in stock in that category, plus any extra skus
 * named on the command line (the seed, which is typically out of stock).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const categoryPath = process.argv[2];
const extras = new Set(process.argv.slice(3));
if (!categoryPath) {
  console.error('uso: node experiments/make-prompt1.mjs <categoryPath> [seedSku...]');
  process.exit(1);
}

const all = readFileSync('.cache/store/products.ndjson', 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

const inCategory = all.filter((p) => p.category === categoryPath);
if (!inCategory.length) {
  console.error(`nenhum produto em ${categoryPath}`);
  process.exit(1);
}
const chosen = inCategory
  .filter((p) => p.stockBand !== '0' || extras.has(p.sku))
  .sort((a, b) => a.name.localeCompare(b.name, 'da'));

const missing = [...extras].filter((s) => !chosen.some((p) => p.sku === s));
if (missing.length) console.error(`! fora da categoria, ignorados: ${missing.join(', ')}`);

const slug = categoryPath.split('/').at(-1);
const out = `experiments/01-tier-${slug}.md`;

writeFileSync(out, `# Prompt 1 — classificar faixa premium

Categoria: \`${categoryPath}\`
${chosen.length} produtos: os em estoque${extras.size ? `, mais ${[...extras].join(', ')}` : ''}.

O modelo NÃO recebe preço. A faixa tem que sair do nome. Isso é de propósito:
deixa conferir depois se a faixa correlaciona com preço, sem que a resposta
tenha vindo do preço.

O texto abaixo não menciona nenhum tipo de produto. A única coisa específica
é o caminho da categoria, que o modelo lê direto.

Cole tudo daqui para baixo.

---

You are a product specialist for Elgiganten, a Nordic electronics and appliance
retailer. You know how brands and product lines are positioned in the Nordic
market, across every kind of product this retailer sells.

Category: ${categoryPath}

Below are products from that category. Assign each one a premium tier from 0
to 3.

The scale:

  0  entry      — the cheapest way to get this kind of product. Budget brands,
                  retailer house brands, nothing in the name that distinguishes
                  it from the next cheapest thing.
  1  mid        — mainstream. An established brand's standard line.
  2  premium    — an established brand's upper line, or a brand that competes
                  only at the upper end of this category. Named series, flagship
                  model designations, design-led lines.
  3  luxury     — the top of a serious brand's range, or a brand whose entire
                  positioning in this category is luxury. Statement products.

Rules:

- Judge WITHIN this category. The question is never "is this expensive for a
  product", it is "where does this sit among products of this kind".
- You are NOT given prices, and you should not try to guess them. Judge market
  positioning from the brand, the product line, and what the name states.
- Size, capacity and quantity are not tier. A big basic product is still entry
  or mid; a small one from a premium line is still premium.
- Format and fitting are not tier either. How a product is installed, mounted,
  connected, packaged or worn tells you where it goes, not how good it is.
  Every format has cheap and expensive versions.
- Colour and finish are not tier on their own, but a named design-led line is a
  positioning signal.
- Use the full scale. If almost everything comes out as the same tier, you are
  not discriminating.
- When you genuinely cannot tell, answer tier 1 and confidence low. Do not
  guess high.

Output: one line per product, comma-separated, no header, no commentary.

  sku,tier,confidence

confidence is \`high\` or \`low\`. \`high\` only when the brand and line clearly
place the product. \`low\` when you are inferring from a model code alone.

Products:

${chosen.map((p) => `${p.sku}\t${p.name}`).join('\n')}
`);

console.log(`${out}  —  ${chosen.length} produtos (${inCategory.length} na categoria, ${inCategory.filter((p) => p.stockBand === '0').length} esgotados)`);
