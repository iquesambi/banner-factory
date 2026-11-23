# Regras de negócio em blocos — como eu estou pensando

Documento de pensamento. Nada desenhado nem desenvolvido.

Você quer blocos arrastáveis que formam o prompt de regra de negócio. Eu
concordo com o formato, e quero propor uma correção no meio dele, porque ela
vem de um erro que a gente acabou de cometer hoje e pagou caro.

---

## A correção: nem toda regra pode virar prompt

Hoje aconteceram duas coisas opostas no mesmo dia.

**Faixa premium como portão deu errado.** Eu filtrava candidato por nível antes
do modelo ver. Numa geladeira Fisher & Paykel de 45.719 kr esgotada, o filtro
cortou um Samsung French Door inox de 37.998 kr em estoque — substituto quase
perfeito — porque o modelo tinha dado um nível abaixo. O modelo recebeu só o
resto e recusou, corretamente. O portão jogou fora a resposta.

**Estoque como portão deu certo.** Produto esgotado nunca chega ao modelo, e
nunca deveria. Se "só em estoque" fosse uma frase no prompt, uma vez em cada
tantas o modelo recomendaria algo esgotado, e aí o banner mente.

A diferença entre as duas não é de grau, é de natureza:

> **O que precisa ser verdade vira código. O que precisa de julgamento vira
> prompt.**

Se os dois tipos entrarem no mesmo texto, o modelo pode desobedecer a regra que
não admite desobediência. Então os blocos têm que ser **tipados** por onde eles
executam, e a interface tem que deixar isso impossível de confundir.

---

## Três faixas, na ordem do fluxo

O editor é uma tela com três colunas, da esquerda para a direita, na mesma
ordem em que o fluxo já roda hoje. Você arrasta o bloco para a coluna, e a
coluna decide o que o bloco é.

```
  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
  │   1. FILTRAR     │   │   2. ESCOLHER    │   │  3. DESEMPATAR   │
  │                  │   │                  │   │                  │
  │  roda em código  │ → │  vira prompt     │ → │  roda em código  │
  │  antes do modelo │   │  o modelo julga  │   │  depois do modelo│
  │                  │   │                  │   │                  │
  │  não admite      │   │  admite          │   │  resolve empate  │
  │  desobediência   │   │  interpretação   │   │  entre válidos   │
  └──────────────────┘   └──────────────────┘   └──────────────────┘
```

A coluna do meio é a única que vira texto de prompt. As outras duas viram
parâmetros de código. O artefato final é um conjunto de regras com três partes,
e uma delas é prompt — não um prompt só.

Essa ordem também resolve uma coisa que eu levantei antes e que você ainda não
decidiu: se as regras filtram antes, **o motivo que o modelo escreve sempre
vale**, porque ele só justificou opção permitida. Se o modelo escolhesse
primeiro e a regra vetasse depois, você ficaria com uma recomendação cuja
justificativa é de outro produto.

---

## Blocos que eu já proporia

### Coluna 1 — Filtrar

| bloco | parâmetro | nota |
|---|---|---|
| **Só em estoque** | — | fixo, não removível. O briefing exige |
| **Estoque mínimo** | banda (`<5`, `5+`, `25+`…) | banner roda uma semana; `<5` esgota no dia 2 |
| **Faixa de preço** | ±X% do preço da semente | cuidado: você já disse que mais barato é vantagem. Isso corta o barato também |
| **Mesma categoria** | — | hoje é implícito no código; virar bloco deixa explícito e removível |
| **Excluir categorias** | lista | ex.: excluir acessório quando a semente é aparelho |
| **Excluir marcas** | lista | acordo comercial, marca em disputa |
| **Precisa ter imagem** | — | sem imagem não há banner. Hoje isso não é checado em lugar nenhum |
| **Desconto mínimo** | X% | é aqui que desconto entra, como você pediu: depois da escolha por mérito |
| **Na campanha ativa** | campanha | ver seção da Black Friday abaixo |

### Coluna 2 — Escolher

Estes viram frases no prompt do recomendador, somadas às instruções fixas que
já existem (acessório não substitui produto, base sozinha substitui bundle,
preço menor é vantagem).

| bloco | vira, no prompt, algo como |
|---|---|
| **Preferir a mesma marca** | "quem escolheu uma marca costuma querer aquela marca; prefira, sem forçar" |
| **Preferir a campanha ativa** | "produtos da campanha X estão marcados; prefira-os quando forem substituto igualmente bom" |
| **Não rebaixar geração** | "não ofereça uma geração anterior da mesma linha, a não ser que não haja alternativa" |
| **Preferir estoque fundo** | "entre substitutos equivalentes, prefira o de estoque mais profundo" |
| **Explicar o que se perde** | já é instrução fixa hoje; como bloco, dá para endurecer ou afrouxar o tom |

### Coluna 3 — Desempatar

Rodam sobre a lista que o modelo já aprovou. Nunca mudam *quem* é válido, só a
ordem.

| bloco | parâmetro |
|---|---|
| **Já tem banner pronto** | posição máxima (padrão: até a 2ª) |
| **Maior desconto primeiro** | — |
| **Estoque mais fundo primeiro** | — |
| **Mais barato primeiro** | — |

O primeiro é a regra de economia do outro documento. O desempate entre duas
cores idênticas, que hoje é um palpite meu no código, passa a ser esse bloco.

---

## O caso da Black Friday, levado a sério

Seu exemplo foi "se campanha de Black Friday estiver rolando, recomendar
produtos da Black Friday". Tentando montar isso, aparece um problema que não é
de interface:

**O feed não tem campo de campanha.** São 18 campos, todos texto, e nenhum diz
"está na Black Friday".

Eu fui atrás do `SalesPoint`, que é o campo de texto promocional, achando que
talvez as campanhas aparecessem ali. Não aparecem: procurei por *black friday*,
*cyber*, *jul*, *påske*, *nytår* e *singles* nos 28.231 produtos e deu **zero**.

Mas o que tem ali é mais útil do que eu esperava. O `SalesPoint` carrega a
**mecânica** da promoção, não o nome dela:

| o que aparece | quantos | o que significa |
|---|---|---|
| `SPAR 750`, `SPAR 300`… | 1.670 | economize X kr — repete o `SavePriceAmount` |
| `Restsalg`, `Rest SPAR 82` | 53 | fim de linha |
| `Køb 4 pk. og betal for 3 pk.` | 46 | leve 4 pague 3 |
| `Klubpris 1499` | 17 | **existe um segundo preço, mais baixo, só para membro** |
| `5 års garanti*`, `7 Års Garanti` | 13 | garantia estendida, com asterisco |
| `Maks 3`, `Maks. 1 stk. pr. kunde` | 11 | **limite por cliente** |
| `Pris ex. Pant` | 7 | o preço não inclui o depósito do vasilhame |
| `OBS! Uden frontplade` | 5 | falta uma peça que o cliente vai supor que vem |

São 636 valores distintos em 1.787 produtos, e 1.670 deles são só a economia
repetida. O resto é o material interessante.

Duas linhas dessa tabela não são preferência, são **verdade do banner**, e
viram filtro obrigatório:

- **`Klubpris`**: eu tinha escrito aqui que o preço do feed era o preço de
  membro. É o contrário, e os dados mostram: o SteelSeries Apex Pro TKL tem
  `price` 2.299 kr e `SalesPoint` "Klubpris 1499". O preço do feed é o preço
  de quem não é membro, e o preço de membro só existe dentro do texto do
  rótulo, em 17 produtos. Os dois jeitos de errar são ruins: mostrar 2.299
  é verdade mas esconde a oferta de verdade, e ler 1.499 como preço é mentir
  para quem não é membro. Nenhum dos dois serve sozinho.
- **`Maks 3`**: há limite de compra, em 11 produtos. Um hero banner levando
  tráfego para um produto limitado a 1 por cliente é promessa que a loja não
  cumpre. O caso mais claro são as caixas de Pokémon e as batedeiras
  Ankarsrum, que combinam garantia de 7 anos com 1 por cliente.
- **`Pris ex. Pant`** e **`OBS! Uden frontplade`**: o preço está incompleto
  ou o produto está. São 12 produtos, e nos dois casos um banner com preço
  grande promete menos do que o cliente vai pagar ou receber.

Então eu proporia dois blocos a mais na coluna 1: **excluir preço de clube** e
**excluir produto com limite de compra** — ou, se você preferir mostrar, um
bloco que force o texto a dizer a condição.

Uma nota de cobertura: 1.787 produtos têm `SalesPoint` e 2.318 têm desconto
calculado. A sobreposição é de 1.600, então 187 têm rótulo sem desconto e 718
têm desconto sem rótulo. Nenhum dos dois sozinho identifica "está em promoção".

E uma nota de confiança, que vale um bloco de filtro por si só: onde o
`SalesPoint` diz `SPAR n`, o número bate com o `SavePriceAmount` em 1.560
produtos e **divergem em 56**. Em três deles o preço antigo é *menor* que o
atual — o LG 86" QNED está 10.077 kr com preço anterior de 8.888 kr e rótulo
"SPAR 1111". O briefing exige que preço e economia no banner venham do feed e
sejam verdade; nesses 59 produtos o feed discorda de si mesmo, então a decisão
não é qual número usar, é não fazer banner de preço para eles.

Para a campanha em si, sobram dois caminhos, e a escolha é sua:

1. **Lista no Firestore.** Alguém sobe os SKUs da campanha. Exato, e dá
   trabalho manual a cada campanha.
2. **Limite de desconto.** "Está na campanha quem tem mais de X% off." Zero
   trabalho, e erra: `Restsalg` de fim de linha entraria na Black Friday sem
   ser da Black Friday — e esses 20 produtos provam que o caso existe.

E o bloco tem **duas metades** que caem em colunas diferentes:

- *"só recomendar produto da campanha"* → coluna 1, filtro. Arriscado: se a
  campanha tem poucos produtos na categoria, a lista fica vazia e você não tem
  banner nenhum.
- *"preferir produto da campanha"* → coluna 2, preferência. Seguro, e perde
  campanha às vezes.

A interface deve oferecer as duas como blocos distintos, com nomes distintos, e
não deixar a diferença escondida num checkbox.

---

## Duas coisas que a tela precisa ter, além dos blocos

### O prompt gerado, visível

Um painel que mostra, ao vivo, o texto que a coluna 2 está produzindo. Sem
isso, blocos arrastáveis são uma caixa-preta bonita: você monta, o resultado
muda, e não sabe por quê.

Isso também é defesa contra o problema de sempre — duas preferências que se
contradizem ("preferir a mesma marca" e "preferir a campanha" quando a campanha
não tem a marca). Lendo o prompt, a contradição fica óbvia. Escondida, ela vira
comportamento aleatório.

### Ensaio antes de salvar

Essa é a parte que eu mais defenderia. O editor roda o conjunto de regras
contra **um punhado de sementes de teste**, sem gastar chamada de modelo, e
mostra:

```
regra: estoque mínimo 25+  ·  faixa de preço ±20%  ·  só campanha

  Fisher & Paykel 45.719 kr    11 candidatos → 0 restam    ⚠ sem banner
  Switch 2 bundle   4.299 kr    13 candidatos → 2 restam
  iPad Pro         27.499 kr    40 candidatos → 1 resta
```

Só a coluna 1 roda, e ela é determinística e de graça. Em dois segundos você vê
que sua regra deixou uma semente sem candidato nenhum — e aí você descobre isso
no editor, não numa campanha ao vivo.

Esse é o mesmo erro que eu cometi hoje com a faixa, em outra roupa: filtro
apertado parece rigor e é perda. A diferença é que agora dá para medir antes.

---

## Versionamento

Um conjunto de regras é versionado e imutável depois de usado. Duas razões:

**O banner depende dele.** O texto do banner sai das regras, então a versão das
regras entra na chave do cache de banner. Mudou a regra, o banner antigo não
serve mais, mesmo com preço igual.

**A execução tem que ser explicável.** O desafio pede que a decisão seja
explicável. "Por que esse produto em 12 de dezembro?" só tem resposta se a
execução gravar qual versão das regras estava valendo. Isso vai no registro da
execução junto com a justificativa do modelo.

---

## O que eu não sei ainda

- **Quantos blocos uma pessoa consegue manter na cabeça.** Vinte blocos
  arrastáveis viram um sistema de programação visual, e esses costumam morrer de
  complexidade. Eu começaria com os seis ou sete mais óbvios e deixaria o resto
  aparecer por demanda.
- **Se regra por categoria é necessária.** Regra de geladeira e regra de celular
  provavelmente não são a mesma. Se forem diferentes, é um conjunto de regras
  por departamento, e aí a tela precisa de um seletor de escopo — o que dobra a
  complexidade do editor. Vale perguntar isso antes de desenhar.
- **Quem pode editar.** Se marketing mexe nas regras sem revisão, uma regra
  apertada derruba os banners de uma campanha. O ensaio acima reduz o risco, não
  elimina.
