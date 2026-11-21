# Detalhes técnicos — Banner Factory

Log completo: o que foi medido, o que deu errado e por quê. É a evidência por
trás dos números do [WORKLOG](../WORKLOG.md) — serve para consulta e para
responder pergunta específica, não para ler antes da apresentação.
Cada step anota **o que foi feito**, **o que foi descoberto** e **o que mudou na
decisão de arquitetura**. Números medidos ficam aqui para não serem redescobertos.

> Doc de trabalho, em português. Se for junto na entrega para a Digital Fans,
> vale uma versão em inglês.

---

## Step 1 — Análise manual do feed

`data/2026-08-25-elkjop-ai-personalisation-pilot-ddb-dk.json.gz`
28.231 produtos, 18 campos, todos string. Descomprimido: 81 MB em **uma única
linha** (por isso não abre bem em editor; gerei amostra estratificada em
`data/_explore/feed-sample.json`, 60 produtos, 3 de cada bucket
`promoção × estoque × faixa de preço`).

### Estoque — distribuição das bandas no feed

| Banda | Produtos | % |
|---|---|---|
| `0` | 12.455 | 44,1% |
| `100+` | 4.744 | 16,8% |
| `5+` | 4.471 | 15,8% |
| `25+` | 2.673 | 9,5% |
| `<5` | 2.060 | 7,3% |
| `50+` | 1.828 | 6,5% |

Medição do feed, sem leitura de negócio: o que fazer com estoque é regra de
produto e não é decisão do tagger.

### Campos de desconto no feed

| | Produtos |
|---|---|
| Com `SavePriceAmount` | 2.515 (8,9%) |
| Com `SalePrice` | 2.552 (9,0%) |

`SalePrice == Price` em **2.552 de 2.552** casos: não carrega valor novo. Preço
antigo não existe no feed e o briefing define como reconstruí-lo:
`Price + SavePriceAmount`.

Aplicando a regra do desconto (tem desconto → calcula; não tem → zero):
**2.318 produtos com `discountPct > 0`**. Os 197 de diferença em relação aos
2.515 têm `SavePriceAmount` presente mas igual a zero.

### Preço — distribuição com cauda longa

```
p0        0 DKK   ← existem produtos com Price = 0
p25     149
p50     399
p75   2.089
p95  14.995
p100 209.999 DKK
```

Mediana 399, máximo 210 mil. Proximidade de preço com o seed tem que ser
logarítmica ou por percentil, nunca linear.

### Preenchimento dos campos

100% em `product-name`, `SKU`, `Price`, `StockLevelEcomFormat`.
`Image` 99,2% · `DescriptionLong` 98,8% · `DescriptionShort` 93,9% ·
bullets ~80% · energy label ~15% · **`SalesPoint` só 6,3%** (1.787 produtos,
636 valores distintos, dominados por `SPAR <valor>`, que só repete o desconto).

226 produtos não têm `Image`.
Todas as 28.005 imagens vêm de um host só, `next-media.elkjop.com`.

### Custo de token por estratégia de input

| O que você manda | Tokens | % do registro completo |
|---|---|---|
| Registro JSON completo | 20,44 M | 100% |
| nome + short + long + bullets | 13,07 M | 64% |
| nome + `DescriptionLong` | 11,31 M | 55% |
| nome + `DescriptionShort` | 1,62 M | 7,9% |
| nome + bullets | 0,74 M | 3,6% |
| **só `product-name`** | **0,31 M** | **1,5%** |

Nome médio: 43 chars (~11 tokens). `DescriptionLong` médio: 1.560 chars.

### Tentativa que não funcionou

Normalizar nomes (tirar modelo, cor, capacidade, ano) para classificar
"esqueletos" em vez de produtos: **só 1,3× de redução** (21.475 esqueletos para
28.231 produtos). Nomes são únicos demais. Abandonado — o nome já é barato o
bastante para não valer a complexidade.

### Léxico manual como baseline

101 palavras dinamarquesas escritas à mão → 21 categorias:

```
só pelo nome           : 16.294/28.231 = 57,7%
nome + short + bullet1 : 19.503/28.231 = 69,1%
```

Serviu de baseline. Substituído no Step 2.

### Observações soltas

- `Professionell` (dois L) é grafia sueca/norueguesa; em dinamarquês seria
  `professionel`. O feed é declaradamente DK mas tem resíduo de outros mercados.
- Catálogo vai muito além de eletrônicos: LEGO (890), Funko (686), embutidos
  (Franke, Liebherr, Smeg).
- Prefixo da URL da imagem (`dv_web_D180...`) é por produto, não por categoria —
  27.834 prefixos distintos para 28.005 imagens. Inútil como sinal.

---

## Step 2 — Taxonomia real do site (categorias e marcas)

Objetivo: parar de inventar taxonomia e usar a da própria marca.

### Como foi obtida

1. `curl` em `elgiganten.dk` bate num **Vercel Security Checkpoint** (detecção
   de bot). Rotas HTML estão protegidas.
2. Abrindo no browser real e passando o checkpoint, o `robots.txt` revela:
   `https://www.elgiganten.dk/service-sitemap-site-elgiganten-dk-da-sitemap_index.xml`
3. Esse índice aponta seis sitemaps, dois úteis: **`sitemap_category.xml`** e
   **`sitemap_brand.xml`**.
4. **Os sitemaps estáticos não têm checkpoint.** `curl` com User-Agent de
   browser baixa os dois com HTTP 200 — reproduzível na aplicação, sem browser.

```bash
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" \
  -o category.xml \
  https://www.elgiganten.dk/service-sitemap-site-elgiganten-dk-da-sitemap_category.xml
```

### O que veio

**723 categorias, 5 níveis, 11 departamentos.** A hierarquia está no path da
URL, então a árvore sai de graça.

| Departamento | Subcategorias |
|---|---|
| `hjem-have` | 201 |
| `sport-fritid-hobby` | 136 |
| `computer-kontor` | 82 |
| `personlig-pleje-skonhed-velvare` | 64 |
| `tv-lyd-smart-home` | 58 |
| `gaming` | 49 |
| `epoq` (cozinha) | 37 |
| `hvidevarer` | 35 |
| `services-tilbehor` | 33 |
| `mobil-tablet-smartwatch` | 27 |
| `outlet` | 1 |

**5.550 marcas** em `sitemap_brand.xml`.

Salvo em `data/taxonomy/`:

| Arquivo | Conteúdo |
|---|---|
| `categories.json` | árvore aninhada, 723 nós com path completo |
| `categories.txt` | mesma árvore indentada, para leitura |
| `brands.json` | 5.550 slugs de marca |

### Resultado do matching contra o feed

**Marca: 83,3%** (23.505/28.231) por lookup puro, zero token. Cobre casos que
whitelist manual não pegaria, tipo `dbramante1928`.

**Categoria: 68,5%** (19.348/28.231), 70,4% no pool promo+estoque.

O caminho até esse número ensinou algo. Primeira tentativa: 47,7%, e a TV
Hisense classificada como `smart-home` porque o token `smart` casava antes de
`tv`. Tentativa de conserto com stopwords: **piorou para 41,8%**, porque o
filtro matou a categoria `tv` (2 caracteres).

O que destravou foi linguístico: **dinamarquês cola substantivos e o composto é
head-final** — o núcleo fica no fim da palavra. `netværksswitch` termina em
`switch`, `tørretumbler` em `tumbler`, `kølefryseskab` em `skab`. Casando
sufixo além de palavra inteira: **+26,7 pontos**, 1.728 produtos resolvidos só
por essa regra.

### Decisão que isso mudou

A taxonomia **não** deve ser usada como string matcher, e sim como **conjunto
fechado de saída do LLM**:

1. Não precisa mais gerar taxonomia com LLM — a real é oficial e da marca.
2. Output vira **índice** (1–3 tokens) em vez de nome escrito. E é
   **validável**: índice fora da árvore é erro detectável, zero alucinação.
3. Composto dinamarquês é trivial para o modelo e sofrido para regex.

O matcher determinístico vira **pré-filtro**: resolve os ~68% fáceis por zero
token, só o resíduo vai ao modelo.

Ganho de lambuja: a árvore dá a estratégia de seleção quase pronta — "quem olhou
X deveria ver Y" fica expressável como **distância na árvore** (mesmo pai, mesmo
avô, mesmo departamento), que é explicável, o que o desafio exige.

---

## Step 3 — Tagger: enriquecimento progressivo em Mastra

### Vocabulário

`matcher` fica reservado para o **algoritmo de match de produto** (a
recomendação). O componente que anota categoria e marca no catálogo passa a se
chamar **`tagger`**. Trechos anteriores deste doc que dizem "matcher" falando de
classificação referem-se ao tagger.

### Escopo do tagger

O tagger faz **três coisas e só elas**: adiciona categoria, adiciona marca e
calcula a porcentagem de desconto. Produto com desconto tem a porcentagem
calculada, sem validação; produto sem desconto tem zero.

Todo o resto que vem do feed é carregado como está. O tagger **não** decide o
que é elegível para banner, não interpreta promoção, não interpreta estoque e
não filtra nada. Essas são regras de produto e são do usuário.

### Desenho

Limpeza progressiva, custo zero por padrão e modelo só onde importa:

1. **Passe determinístico sobre a base inteira** — marca e categoria por lookup
   e casamento de string. Sem IA, custo zero, re-rodável a cada troca de feed.
2. **Validação sob demanda** — quando um produto entra em destaque (é o seed) ou
   aparece numa lista de recomendados, o modelo mais barato confirma ou corrige
   a categoria dele. A base vai ficando limpa exatamente onde está sendo usada.
3. **Estado persistido** — cada produto carrega em que ponto da limpeza está, e
   a validação é invalidada se a taxonomia ou o feed mudarem.

```
raw         nunca passou pelo tagger
auto        categoria determinística, nenhum modelo viu
unresolved  determinístico não achou âncora no nome
validated   modelo confirmou a categoria determinística
corrected   modelo sobrescreveu a categoria determinística
```

`taxonomyVersion` e `feedVersion` (hash dos arquivos) ficam em cada registro: se
qualquer um dos dois muda, `needsValidation()` volta a dar true. Um rebuild
**preserva** as validações cujo nome de produto e versão de taxonomia não
mudaram (`carriedOverValidations`), para não jogar fora trabalho pago.

### Estrutura

| Caminho | Papel |
|---|---|
| `src/taxonomy/` | carrega `categories.json` + `brands.json`, versiona por hash |
| `src/tagger/normalize.ts` | folding nórdico (ø→o, æ→a, å→a) nos dois lados |
| `src/tagger/category.ts` | `CategoryTagger`: termos, IDF, composto, score |
| `src/tagger/index.ts` | `tagCatalog()`: passe determinístico completo |
| `src/store/` | NDJSON + meta, flags de estado |
| `src/mastra/agents/category-validator.ts` | agente, modelo barato, output = índice |
| `src/mastra/workflows/tag-catalog.ts` | workflow do passe determinístico |
| `src/mastra/workflows/validate-products.ts` | workflow de validação sob demanda |
| `src/eval/stats.ts` | RNG com seed, amostragem, intervalo de Wilson |
| `src/cli/eval-sample.ts` | o teste dos 25 com relatório |

```bash
npm install
npm run tag           # passe determinístico, custo zero
npm run eval:sample -- --seed=42
```

Flags do eval: `--size=100`, `--stratified`, `--eligible-only`, `--seed=N`.
O seed é impresso e o relatório salvo em `.cache/eval/sample-<seed>.json`, então
qualquer rodada é reproduzível.

### Duas decisões de economia de token

**Output é índice, não nome.** O validador recebe uma lista numerada de
candidatos e devolve `{ choice: number, confidence }`. Dois tokens de saída, e
categoria alucinada é **impossível de representar** — se o índice está fora da
lista, é erro detectável, não texto plausível.

**Input é só o nome.** Descrição longa tem 1.560 chars em média e não acrescenta
nada à classificação.

### Resultado do passe determinístico

28.231 produtos em **~1s**, custo zero:

| | |
|---|---|
| Marca | 23.511 — **83,3%** |
| Categoria | 14.811 — **52,5%** |
| Unresolved | 13.420 — 47,5% |

> Nota: 950, não 998 como medido antes. A diferença são 48 produtos com
> `SavePriceAmount` presente mas zero ou não parseável. Promoção de 0 DKK não é
> promoção; o número novo está mais correto.

### A cobertura caiu de 68,5% para 52,5% — de propósito

O filtro por frequência (`MAX_DF_RATIO = 0.15`) descartou **um único termo**:
`pc`, com `df=5048`. Ele sozinho respondia por quase toda a diferença.

E descartar foi certo: `pc` apontava para `computer-kontor/computere/stationar-pc`,
ou seja, ~5.000 produtos estavam sendo classificados como **computador de mesa**
por conterem a palavra "PC" no nome. Eram quase todos jogos digitais ("… - PC
Windows"). Cobertura menor, precisão maior.

Isso também substituiu a lista de stopwords escrita à mão: `smart` e companhia
agora são penalizados por IDF, com base no que o dado diz, não no que eu lembrei
de blocklistar.

### O que o teste dos 25 revelou (seed=42)

Sem chave de API ainda, então a etapa do modelo saiu como `skipped` — mas a
amostra determinística já expôs os modos de falha, que era metade do objetivo.

**Acertos claros:** `Ecotronic væghængt emhætte` → `hvidevarer/emhatte` ·
`ASKO Opvaskemaskine` → `opvaskemaskine` · `Samsung French Door Kølefryseskab`
→ `kolefryseskab` · `Epoq Kummefryser` → `kummefryser` ·
`GitGud Flamingo musemåtte` → `musematte` ·
`Hisense 50" E7Q 4K QLED Smart TV` → `tv-lyd-smart-home/tv-tilbehor/tv`.

**Falso positivo exemplar:**

```
ABYstyle Magic The Gathering kop 600ml  ->  mobil-tablet-smartwatch/smart-ring
```

Uma **caneca** classificada como **anel inteligente**. A regra de composto
head-final casou `ring` como sufixo de `Gathe|ring`. A regra é certa para
dinamarquês e errada para inglês — e os nomes do feed misturam as duas línguas.

Pior: o score foi 6,99 e a **margem também 6,99**, porque era o único candidato.
Ou seja, **margem alta não indica acerto** — indica apenas ausência de
alternativa. A margem não serve como medida de confiança sozinha.

Outro: `Steba ismaskine STIC30` → `candyfloss-maskine`. Sorveteira virou máquina
de algodão doce; o sufixo `maskine` é genérico e escolheu a folha errada entre
várias `*-maskine`.

Dos 1.795 produtos resolvidos por sufixo, **817 têm margem < 0,5**.

**O grande bloco de unresolved são jogos digitais:**

| Padrão | Produtos unresolved |
|---|---|
| Contém `" - PC"` | 4.348 |
| Termina em `- PC Windows/Linux/Mac` | 3.174 |
| PlayStation / Xbox / Switch | 393 |

E a taxonomia **tem** onde colocá-los: `gaming/spil`. Uma regra determinística
de sufixo de nome recuperaria ~3.000–4.300 produtos de graça, todos corretos.
Não implementei ainda — ver ponto em aberto 13.

---

## Step 3b — Validador rodando com a chave real

### Três coisas que só apareceram ao rodar

**1. `gemini-2.0-flash-lite` foi descontinuado.** A própria API respondeu com o
substituto: `gemini-3.5-flash-lite`. Atualizado no `.env` e no default do código.

**2. Free tier limita a 15 requests/minuto.** Uma chamada por produto não
sustenta validação de lista de recomendados. Implementado lote de 10 produtos
por request, com throttle de RPM e retry no 429 lendo o delay sugerido:

| | 1 produto/request | Lote de 10 |
|---|---|---|
| 25 produtos | 25 requests, 51s, 3 erros de quota | **3 requests, 4,0s, 0 erros** |

Ou seja: o lote deixou de ser otimização de token e passou a ser requisito.

**3. A chave estava no `.env.example`.** Esse arquivo é o template que vai para o
repositório. Movido para `.env` (ignorado), template restaurado com valor vazio.
A chave nunca entrou no histórico do git. `.gitignore` já cobria `.env`.

### Dois erros na minha própria métrica

**Erro 1: somei preenchimento com correção.** Na primeira rodada o relatório
disse "precisão 47,4%". Falso: de 10 "correções", **9 eram preenchimento** de
produtos que o tagger havia deixado sem categoria, e só **1** era correção
genuína de um palpite errado. São fatos diferentes e não podem ser somados.
O relatório agora separa em A) precisão onde o tagger tinha categoria e
B) preenchimento onde ele não tinha nada.

**Erro 2: contei categoria escrita pelo modelo como acerto do tagger.** Como a
base vai ficando limpa a cada rodada, na segunda execução os produtos que o
modelo preencheu antes apareciam como "tagger tinha categoria" — e confirmá-los
media o modelo concordando consigo mesmo. O eval agora só conta precisão sobre
tags cuja origem é `phrase`/`exact`/`compound`.

### Medição limpa (seed=7, n=100, store reconstruído)

```
A) PRECISAO onde o tagger tinha categoria
   confirmados   : 27/50
   corrigidos    : 4
   tagger errado : 19   (modelo rejeitou todos os candidatos)
   ponto         : 54,0%
   IC 95% Wilson : 40,4% — 67,0%

B) PREENCHIMENTO onde o tagger não tinha nada
   preenchidos   : 50/50
   ponto         : 100,0%
   IC 95% Wilson : 92,9% — 100,0%   (nível de departamento, não de folha)
```

10 requests, 39,8s, zero erros. Extrapolando: dos 14.811 com categoria
automática, ~8.000 corretos e **~6.800 a corrigir**.

### A causa raiz dos 19: minha regra de head-noun está errada para slug composto

Os rejeitados não são aleatórios. São três armadilhas sistemáticas:

| Slug da taxonomia | Head que eu extraí | Casa errado com |
|---|---|---|
| `gaming-controllere-til-pc-og-smartphone` | `smartphone` | **todo smartphone** do catálogo |
| `lego-pokemon`, `lego-harry-potter`, `lego-art`, `lego-creator`, `lego-sonic-the-hedgehog` | `pokemon`, `potter`, `art`… | lâmpada do Pikachu, caneca do Harry Potter, "SWORD ART ONLINE" |
| `netvark/switch` | `switch` | `Philips SceneSwitch` (plafon!), jogos de Nintendo Switch |

Exemplos reais da amostra:

```
iPhone 17 Pro 5G smartphone 256GB   -> gaming/spiltilbehor/gaming-controllere-til-pc-og-smartphone
Samsung Galaxy S26 5G smartphone    -> gaming/spiltilbehor/gaming-controllere-til-pc-og-smartphone
Teknofun Pokémon LED lampefigur     -> sport-fritid-hobby/lego/lego-pokemon
Nemesis Now Harry Potter drikkekrus -> sport-fritid-hobby/lego/lego-harry-potter
Philips SceneSwitch plafond-lys 15W -> computer-kontor/netvark/switch
```

**Todo smartphone do catálogo está classificado como controle de videogame** —
e smartphone é das categorias mais importantes para um banner de retargeting.

A causa é precisa: eu tomo a **última palavra** do slug como head. Isso é correto
para composto *dentro* de uma palavra (`netvaerks|switch` → switch), e **errado**
para slug de várias palavras. Em dinamarquês, construção com preposição qualifica
para a direita: `gaming-controllere-til-pc-og-smartphone` é "controles **para** PC
e smartphone" — o head é `controllere`. E `lego-pokemon` é "LEGO do Pokémon" — o
head é `lego`.

**Hipótese a testar:** head de slug multi-palavra = **primeira** palavra (ou a
palavra antes da primeira preposição `til`/`og`/`for`/`med`); head de palavra
única = sufixo. Ver ponto em aberto 14.

### Falta uma rota de fuga quando o tagger erra

Para produto já categorizado, eu ofereço ao modelo **apenas os candidatos do
tagger**. Se os 5 candidatos estão todos no galho errado, o modelo não tem como
dar a resposta certa — só pode dizer -1. Foi o que aconteceu nos 19.

Correção: ao receber -1 num produto coberto, reperguntar com os 11
departamentos, como já é feito para unresolved. Uma segunda chamada barata para
a minoria dos casos, e os 19 deixariam de ficar sem categoria.

### O modelo está fazendo bom trabalho

As 4 correções genuínas foram todas defensáveis, e duas pegaram armadilhas:

```
Smeg Universal Induktionskogeplade  fritstaende-kogeplade -> integreret-kogeplade
Metroid Prime 4: Beyond (Switch)    netvark/switch        -> nintendo-switch
Ring Fit Adventure - Switch         smart-ring            -> nintendo-switch
Steba ismaskine STIC30              candyfloss-maskine    -> ismaskine-slush-ice-maskine
```

O gargalo não é o modelo, é a lista de candidatos que eu entrego a ele.

---

## Step 3c — Correção da regra de head-noun + rota de fuga

### As duas mudanças

**1. Head de slug multi-palavra** (`src/tagger/category.ts`):

- Palavra única → continua casando por sufixo (composto dinamarquês é
  head-final: `netvaerks|switch` → switch).
- Multi-palavra com preposição (`til`, `og`, `for`, `med`, `uden`, `af`, `i`,
  `pa`) → head é a última palavra **antes** da preposição. `vagbeslag til tv` é
  um suporte, não uma televisão. `gaming controllere til pc og smartphone` é um
  controle, não um celular.
- **Filho cujo slug começa com a mesma palavra do pai** → registra só a frase
  completa, nenhum termo de palavra única. `lego/lego-pokemon` é LEGO do tema
  Pokémon, e `lego-tilbehor-og-merch/lego-krus` é uma caneca LEGO; extrair
  `pokemon` ou `krus` de lá puxava toda lâmpada do Pikachu e toda caneca do
  catálogo para dentro do galho LEGO.

**2. Rota de fuga de duas passadas** (`src/mastra/workflows/validate-products.ts`):
quando o modelo responde -1 para um produto já categorizado, ele não fica
unresolved — vai para uma segunda chamada em lote com os 11 departamentos, o
mesmo conjunto fechado que os nunca-categorizados recebem.

### Medição, mesmo seed (seed=7, n=100, store reconstruído)

| | Antes | Depois |
|---|---|---|
| Precisão onde havia categoria | 54,0% | **69,0%** |
| IC 95% Wilson | 40,4 — 67,0% | **54,0 — 80,9%** |
| Rejeitados sem saída (`tagger errado`) | 19 | **0** |
| Cobertura determinística | 52,5% | 48,5% |
| Requests ao modelo | 10 | 11 |
| Preenchimento de unresolved | 100% | 100% |

Extrapolando: de ~6.800 produtos a corrigir para **~4.200**.

A cobertura caiu 4 pontos de propósito, de novo: trocamos tag errada por
"não sei" honesto, e o modelo resolve o "não sei" com acerto alto.

### Armadilhas verificadas uma a uma

```
iPhone 17 Pro 5G smartphone       gaming-controllere...  ->  unresolved  ✓
Teknofun Pokémon LED lampefigur   lego-pokemon           ->  unresolved  ✓
Nemesis Now Harry Potter krus     lego-krus              ->  unresolved  ✓
SWORD ART ONLINE - PC Windows     lego-art               ->  unresolved  ✓
Hedgehog vægophæng                lego-sonic-the-hedgehog->  unresolved  ✓
```

E os acertos legítimos continuam de pé: `netværksswitch` → switch ·
`Tørretumbler` → torretumbler · `Smart TV` → tv · `Kølefryseskab` →
kolefryseskab · `bærbar computer` → barbar-computer · `Emhætte` → emhatte.

### Duas que sobraram, e por quê

```
Philips SceneSwitch plafond-lys   ->  computer-kontor/netvark/switch
ABYstyle Magic The Gathering kop  ->  mobil-tablet-smartwatch/smart-ring
```

Ambas são sufixo casando dentro de **palavra inglesa**: `Scene|switch` e
`Gathe|ring`. A regra de composto está correta para dinamarquês e os nomes do
feed misturam as duas línguas. Resolver isso deterministicamente exigiria saber
que "Gathering" é inglês, o que não se tira do feed.

Não são mais um problema: a rota de fuga pega as duas (o modelo responde -1 e
recebe os departamentos). Custam uma chamada extra em lote, não um erro.

### A lacuna de vocabulário entre feed e taxonomia

Descoberta ao investigar os celulares: a categoria real da loja é
`mobil-tablet-smartwatch/mobiltelefon` — **em dinamarquês**. O feed escreve
"smartphone", em inglês. Casamento por string não cruza sinônimo, então celular
fica unresolved para sempre no passe determinístico.

Não vou escrever tabela de sinônimo à mão: isso recria o problema da lista de
stopwords. O caminho é a limpeza progressiva ensinar o léxico — quando o modelo
coloca repetidamente produtos com "smartphone" em `mobiltelefon`, esse par vira
um termo aprendido. Ver ponto em aberto 15.

---

## Step 3d — Tabela de sinônimos curada

### Por que, depois de eu argumentar contra duas vezes

Eu resistia a escrever tabela à mão por analogia com a lista de stopwords que o
IDF aposentou. A decisão de produto foi outra, e está certa: **celular precisa
estar certo**, é a categoria mais importante de um banner de retargeting, e
esperar que um mecanismo de aprendizado futuro resolva isso é apostar o item mais
valioso numa promessa.

A distinção que faltava no meu argumento: a lista de stopwords tentava cobrir
**todo** o vocabulário e por isso nunca ficava pronta. Esta tabela cobre **dez
categorias escolhidas**, as que o match por string não alcança e que mais valem
num banner. É pequena, auditável, e cada linha diz por que existe.

### Desenho

`data/taxonomy/synonyms.json`, com quatro campos por entrada:

| Campo | Papel |
|---|---|
| `words` | casa palavra inteira no nome |
| `suffixes` | casa cauda de composto dinamarquês (`punge\|etui`) |
| `requireAny` | exige que outra palavra também apareça |
| `excludeAny` | impede o casamento |

**A ordem do arquivo é a prioridade**, e acessório vem antes do aparelho que ele
nomeia: "iPhone 17 silikonecover" é uma capa, não um telefone. Mesma lição do
`vagbeslag til tv`.

`requireAny` resolve o par capa-de-tablet versus capa-de-celular: a entrada de
tablet vem primeiro e exige `ipad`/`tablet`/`tab` no nome.

Duas garantias:

- **Peso 100** no score, acima de `phrase` (3,0). Sinônimo é decisão humana
  sobre categoria importante e vence qualquer coisa inferida do slug.
- **Validação no load**: todo `path` é conferido contra `categories.json` e o
  load falha com a lista dos inválidos. Arquivo mantido à mão desalinha no
  momento em que a taxonomia for rebaixada; falhar alto é melhor que rotear
  produto para categoria inexistente.
- `synonyms.json` entra no hash de `taxonomyVersion`, então editar a tabela
  invalida as validações feitas sob a tabela antiga.

### Resultado: as duas métricas subiram juntas

| | Início | Pós head-noun | Pós sinônimos |
|---|---|---|---|
| Precisão | 54,0% | 69,0% | **77,6%** |
| IC 95% Wilson | 40,4 — 67,0% | 54,0 — 80,9% | **65,3 — 86,4%** |
| Cobertura determinística | 52,5% | 48,5% | **59,6%** |
| Rejeitados sem saída | 19 | 0 | **0** |

Primeira vez que cobertura e precisão melhoram na mesma mudança — as anteriores
sempre trocavam uma pela outra. Produtos a corrigir: ~6.800 → ~3.800.

**10 entradas renderam 4.189 produtos classificados**:

```
1367  samleobjekter-merchandise/samlefigurer
1015  mobiltilbehor/mobilcovers
 442  mobiltelefon
 360  tilbehor-til-printer/printerblak
 300  el-belysning/lamper-belysning
 206  smartwatch
 188  tablet
 125  horetelefoner-tilbehor/horetelefoner
 108  tablet-tilbehor/covers-etuier-til-tablet
  78  tilbehor-til-printer/printer-toner
```

### Celular, especificamente

```
mobiltelefon : 442 produtos
ainda em gaming-controllere : 3  (eram centenas)
```

E os 3 restantes são controles de verdade — dois são consoles Nintendo Switch
OLED vendidos *com* Joy-Con, ambiguidade do tipo que o modelo resolve.

Pares acessório/aparelho conferidos um a um:

```
iPhone 17 Pro 5G smartphone        -> mobiltelefon
Samsung Galaxy S26 5G smartphone   -> mobiltelefon
Honor 400 smartphone 5G            -> mobiltelefon
Apple iPhone 17 silikonecover      -> mobilcovers
ZAGG Folio Galaxy A57 pungetui     -> mobilcovers
dbramante1928 iPad Pro 11" cover   -> covers-etuier-til-tablet
iPad Pro 11" (M5) 1TB WiFi + 5G    -> tablet
Samsung Galaxy Watch8 smartwatch   -> smartwatch
```

### Bônus inesperado

`Philips Superslim SceneSwitch plafond-lys` saiu de `netvark/switch` para
`lamper-belysning`. A entrada de iluminação pegou o termo `lys` e venceu o
sufixo `switch` pelo peso. Uma das duas armadilhas de palavra inglesa que eu
tinha dado como insolúvel no determinístico resolveu de graça.

---

## Decisões tomadas até aqui

| # | Decisão | Por quê |
|---|---|---|
| 1 | **Nunca mandar `DescriptionLong` ao modelo** | 35× o custo do nome, ~zero valor para classificar |
| 2 | **Workflow, não agente**, para o enriquecimento | pipeline é fixo; agente paga tokens para re-derivar fluxo conhecido |
| 3 | **Taxonomia como conjunto fechado de saída** | output de 1 token, validável, sem alucinação |
| 4 | **Enriquecer offline; seleção em runtime custa 0 token de LLM** | seleção vira query pontuada + similaridade; só o copy chama modelo |
| 5 | **Marca por lookup no `brands.json`** | 83,3% de graça |
| 6 | **Modelo barato para classificar, modelo bom para copy** | qualidade só aparece no texto |
| 7 | **Lote de 10 produtos por request** | free tier limita a 15 req/min; deixou de ser otimização e virou requisito |
| 8 | **Tabela de sinônimos curada para 10 categorias** | match por string não cruza sinônimo, e celular é a categoria mais importante do banner — ver Step 3d |
| 9 | **Rota de fuga de duas passadas** | quando os candidatos do tagger estão todos errados, o modelo precisa de um conjunto mais amplo, senão só pode responder -1 |

---

## Pontos em aberto e considerações

### 1. Perfis de cliente

**Os quatro arquivos em `examples/design-references/` são os segmentos**, já
definidos pelo time da Digital Fans:

```
01-established-households     famílias estabelecidas
02-support-seekers            quem precisa de ajuda / suporte
03-students-first-apartment   estudantes, primeiro apartamento
04-tech-enthusiasts-gamers    entusiastas de tech e gamers
```

#### O que o briefing diz, exatamente

Pensar em perfil **não é extra, é parte do brief**. O README menciona duas vezes:

- **Linha 115**, em "Choosing the product", a seção que ele próprio chama de
  coração do desafio: *"show something on promotion that fits the profile of a
  person who looked at the seed product"*. Instrução direta.
- **Linha 130**, na tabela "What we give you": *"4 reference banners, one per
  customer segment, made by our team"*.

Mas o briefing **nunca nomeia os quatro segmentos** em prosa. A seção "The two
sets of examples", que descreve `design-references/` em detalhe, fala apenas em
"a direction for personalised banners", sem mencionar segmento. Os nomes existem
só nos filenames.

Ou seja: o **conceito** está briefado explicitamente; a **taxonomia** dos quatro
segmentos é um sinal deixado sem explicação. Adotar justamente esses quatro é
escolha nossa — bem apoiada, e alinha a solução com o que eles já desenharam,
mas é escolha, não requisito. Vale declarar isso na entrega.

**O problema real**: não temos dado comportamental, só o seed product. Então a
pergunta é *inferir o segmento a partir de um único produto visto*. Sinais
disponíveis no feed:

| Sinal | O que sugere |
|---|---|
| Faixa de preço do seed | estudante (baixo) vs household estabelecido (alto) |
| Departamento | `gaming` → entusiasta; `hvidevarer`/`epoq` → household; `sport-fritid-hobby` → hobby |
| Presença de energy label | eletrodoméstico grande → household/mudança de casa |
| Categoria de acessório vs produto principal | acessório pode indicar quem já tem o aparelho |
| Marca premium vs entrada (Miele/Smeg vs Sandstrøm) | poder de compra |

Questões a decidir:
- O segmento é **saída intermediária explicável** ("inferi household porque o
  seed é uma máquina de lavar de 8.000 DKK") ou só peso interno no score?
- Mostrar o segmento inferido na UI? Ajudaria muito no "a decisão é deliberada e
  explicável" que o desafio pede.
- Um seed pode ser ambíguo (um iPhone serve a todos os quatro). Precisa de
  segmento "neutro"/sem inferência?
- O segmento deve influenciar o **copy** (tom, benefício destacado) além da
  escolha do produto? As design references sugerem que sim.

### 2. Precisão do tagger

Resolvido em parte no Step 3: o IDF matou o over-matching (`gaming` voltou de
6.550 para 1.765) e a TV Hisense agora cai na folha `tv` correta. O encaminhamento
previsto se confirmou — o determinístico virou pré-filtro que propõe candidatos,
e o modelo escolhe.

Ainda aberto:

- **Sufixo de composto dispara em inglês.** `Gathe|ring` → `smart-ring`. Precisa
  de guarda: só aplicar a regra quando a palavra inteira parecer dinamarquesa,
  ou exigir que o sufixo seja um nó folha de categoria frequente no feed.
- **Margem não mede confiança.** Candidato único dá margem máxima. A métrica de
  confiança tem que considerar `paths.length` e o IDF absoluto, não só o gap.
- **Sufixos genéricos escolhem a folha errada** entre irmãs (`*-maskine`).
- 817 dos 1.795 casamentos por sufixo têm margem < 0,5 — fila natural para
  validação pelo modelo, por ordem de risco.

### 14. Head-noun de slug multi-palavra — FEITO no Step 3c

54,0% → 69,0% de precisão, rejeitados sem saída de 19 → 0. Resta subir de 69%,
onde os candidatos conhecidos são: guarda de língua no sufixo de composto
(`Gathe|ring`), e desempate entre folhas irmãs genéricas (`*-maskine`).

### 15. Léxico aprendido a partir das correções do modelo

O feed e a taxonomia usam vocabulários diferentes: "smartphone" (inglês, no
feed) versus `mobiltelefon` (dinamarquês, na taxonomia). Casamento por string
não cruza sinônimo.

Tabela de sinônimo à mão recria o problema da lista de stopwords. O caminho é
realimentar: quando o modelo colocar N produtos contendo um termo desconhecido
sempre na mesma categoria, promover esse par a termo do léxico, com a origem
registrada. Assim a limpeza progressiva reduz o custo das rodadas seguintes, que
era a ideia do desenho desde o começo.

Decidir: limiar de N, e se o termo aprendido vale só para o feed atual ou
persiste entre versões.

### 13. Jogos digitais — decisão de produto, pendente com você

4.348 produtos unresolved contêm `" - PC"` no nome e 3.174 terminam em
`- PC Windows/Linux/Mac`. A taxonomia tem `gaming/spil`, então classificá-los é
possível.

O tagger não opina sobre se eles entram ou não em banner. Pendente: se vale a
regra determinística de padrão de nome, ou se o preenchimento sob demanda basta.

### 3. Seed fora de estoque

44% do feed está em `StockLevelEcomFormat: 0`. O README diz explicitamente que o
seed pode ser um desses e que o que fazer é parte da estratégia. Opções:
mostrar o mais próximo em estoque da mesma categoria; subir um nível na árvore;
cair para promoção do mesmo departamento. Precisa de regra declarada.

### 4. Escada de fallback

Pool de promoção é só 998 produtos para 723 categorias. Muitos seeds não terão
promoção nenhuma na sua categoria. Precisa de uma escada explícita, algo como:

```
mesma categoria em promoção
  → mesmo pai em promoção
    → mesmo departamento em promoção
      → seed em si (retargeting puro)
```

O desafio diz que mostrar o seed é resultado válido. O importante é que o degrau
escolhido seja registrado e exibível.

### 5. Proximidade de preço

Com p50=399 e p100=209.999, qualquer regra linear quebra. Usar log ou
percentil. E decidir: o produto mostrado deve ser mais barato que o seed
(tentar converter), similar (substituto), ou pode ser mais caro (upsell)?

### 6. Restrições duras do copy

`brand/copywriting-guidelines.md` dá limites concretos para o gerador:
- Headline **30–45 chars, nunca mais de 60**
- Sem pontuação final, exceto interrogação
- Cada linha com função própria, sem repetir
- Benefício, não especificação
- Nada de urgência fabricada nem superlativo vazio
- Voz: "trusted advisor", como vendedor que gosta do cliente

Isso vira **validação programática** pós-geração, não só instrução no prompt.

### 7. Contradição a resolver: urgência

As guidelines proíbem urgência fabricada ("Hurry!", "Last chance!!") — mas o
banner de produção `01-dk-sidste-chance` é literalmente "última chance". Os
exemplos de produção e o guia não concordam. Decidir de que lado ficar e
registrar a escolha.

### 8. Snapshot congelado

O feed é de 2026-08-25. As promoções são, por definição, velhas. Não é problema
para o desafio, mas vale dizer na entrega que a arquitetura não depende disso.

### 9. Imagens do produto

Ainda não verifiquei fundo (transparente? branco?), proporção nem resolução. Isso
determina como compor o banner 2048×768. 226 produtos sem imagem precisam ser
filtrados antes da seleção, não depois.

### 10. Idioma × mercado

Três idiomas (DA, SV, EN), preços sempre em DKK. O idioma muda o texto, não o
mercado. O feed é dinamarquês, então gerar SV e EN é tradução/transcriação a
partir de fonte DA — e as guidelines pedem que leia como língua nativa, não como
tradução.

### 11. Energy label no banner

~15% dos produtos têm classe energética. Os banners de produção mostram isso?
Vale checar — se sim, é mais um dado verdadeiro de graça para eletrodoméstico.

### 12. Custo e tempo (nice to have)

O desafio pede opcionalmente mostrar custo e tempo por banner e como otimizar.
A arquitetura escolhida já é a resposta: enriquecimento offline amortizado,
seleção com 0 token, uma chamada de copy por banner. Falta instrumentar e exibir.

---

## Próximos passos

1. Voltar ao matcher (ponto 2) e fechar a estratégia de classificação de categoria.
2. Definir inferência de segmento a partir do seed (ponto 1).
3. Montar o dataset de ~25 produtos bem diferentes que o README recomenda, e
   usá-lo para validar seleção e copy antes de construir interface.
4. Escrever a escada de fallback (ponto 4) como regra declarada e testável.
5. Checar as imagens (ponto 9) antes de desenhar o layout do banner.
