# Interface — como eu estou pensando

Documento de pensamento, não especificação. Nada desenhado nem desenvolvido
ainda. O que eu quero fechar aqui são as decisões que, se ficarem erradas,
custam retrabalho depois.

---

## O que a interface precisa fazer

Quatro coisas, na ordem em que a pessoa usa:

1. Entrar
2. Achar o produto semente
3. Acompanhar o processo e ver o custo
4. Receber o banner, e achar os que já foram feitos

E uma quinta, que é o editor de regras de negócio e está em
[regras-de-negocio.md](./regras-de-negocio.md).

---

## A decisão mais importante: reaproveitar banner

Você levantou isso e é a melhor ideia de economia que apareceu até agora.
Depois que o recomendador devolve a lista ranqueada, se algum daqueles
produtos já tem banner gerado, dá para usar o que existe em vez de gerar de
novo.

Só que o briefing diz, com estas palavras:

> Everything in the banner is true: the product, the price and the saving come
> from the feed and are never invented.

O banner mostra **preço**. Então um banner guardado não é reaproveitável só
porque é do mesmo produto — ele é reaproveitável enquanto **os fatos que ele
mostra na tela continuarem verdadeiros**. Se o preço mudou, o banner guardado
passou a mentir, e mostrar ele é pior que gastar para gerar outro.

Isso define a chave do cache. Não é `sku`. É:

```
sku + idioma + versão-das-regras + impressão-dos-fatos-mostrados
```

A impressão dos fatos é um hash de `price`, `oldPrice`, `discountPct` e, se o
banner mencionar estoque, da banda de estoque. Qualquer um mudar, o banner
vence e sai do cache sozinho.

É o mesmo padrão que já está no projeto: `taxonomyVersion` e `feedVersion`
invalidam validação de categoria, e `tierCategory` invalida faixa. Mesma ideia,
aplicada à peça final. Gosto disso porque é consistente e porque a invalidação
é automática em vez de depender de alguém lembrar.

**A versão das regras entra na chave** porque o texto do banner depende das
regras de negócio. Se você mudar a regra de campanha, o texto que ela produzia
não vale mais, mesmo com preço igual.

### Reaproveitar pode piorar a recomendação, e isso precisa de regra

Se a lista vier com cinco produtos e o terceiro tiver banner pronto, usar o
terceiro economiza tudo — mas o modelo colocou ele em terceiro por algum
motivo.

Então reaproveitar não pode ser "use qualquer um que tenha cache". Precisa de
um limite, e o limite é seu. Minha sugestão de ponto de partida: reaproveita se
o produto com cache está **entre os dois primeiros**. Fora disso, gera novo.
Assim a economia nunca compra uma recomendação ruim.

Esse é um bloco de regra arrastável no editor, não uma constante no código.

### Quanto isso economiza, na real

É um cache de cauda longa. Produtos que são bom substituto para muita coisa vão
acumular acerto rápido — o Samsung French Door inox apareceu como primeira
recomendação em duas sementes diferentes de geladeira nos testes de hoje. O
resto do catálogo nunca acerta. Então a taxa de acerto cresce com uso e nunca
chega perto de 100%, e o painel de custo deve mostrar **acertos de cache**
explicitamente, para você ver isso acontecendo em vez de acreditar em mim.

---

## Firebase

**Auth.** Firebase Auth, login por Google ou link de e-mail. Não vejo motivo
para complicar: é ferramenta interna de marketing, não produto público.

**Firestore.** Quatro coleções:

| coleção | o que guarda | chave |
|---|---|---|
| `banners` | a peça pronta: URL da imagem, o texto, os fatos no momento da geração, custo | `sku_idioma_versaoRegras_hashFatos` |
| `runs` | cada execução do recomendador: etapas, decisão, lista, custo | id da execução |
| `rules` | os conjuntos de regras de negócio, versionados | id + versão |
| `campaigns` | campanhas ativas e quais produtos entram nelas | id |

**Cloud Storage** para as imagens 2048 × 768.

Uma coisa que o Firestore resolve de graça e que vale usar: o **passo a passo
ao vivo**. O fluxo já emite um evento por etapa e já sabe mandar para um
webhook. Se o webhook escrever no documento da execução no Firestore, a tela
ouve esse documento e atualiza sozinha. Sem WebSocket, sem SSE, sem polling
escrito à mão. É o encaixe mais limpo entre o que já existe e o que falta.

### O que fica fora do Firestore

O catálogo. São 28.231 produtos que eu leio, grepo e comparo na mão o tempo
todo, e isso continua em NDJSON. Jogar ele no Firestore custaria leitura por
consulta e tiraria a coisa mais útil que eu tenho hoje, que é `jq` no arquivo.

O histórico de execuções do motor também já está persistido no storage do
Mastra (libsql). O `runs` do Firestore é a cópia que a interface lê, não a
fonte.

---

## Tela 2 — busca do produto semente

O problema real aqui é que são 28 mil produtos e nenhum campo de busca pronto.

Firestore faz busca por prefixo, não por substring. Procurar "fold8" não acha
"Samsung Galaxy Z Fold8 Ultra" com prefixo. Então não vale subir o catálogo
para o Firestore só por isso.

O caminho simples: uma rota no servidor que monta um índice em memória no boot
a partir do store. Os 28 mil nomes somam uns 1,2 MB — cabe na memória sem
pensar, e substring em 28 mil strings é instantâneo. Sem dependência nova, sem
serviço de busca.

O que a linha de resultado precisa mostrar, porque é o que faz a pessoa
escolher certo:

- imagem, nome, preço
- **estoque**, porque semente em estoque é o caminho de custo zero e é bom isso
  ficar visível antes de clicar
- categoria e faixa, com um aviso quando a categoria é só `auto` e nunca foi
  validada — é o sinal de que essa execução vai gastar mais
- se já existe banner para ele

Também quero um atalho para as sementes de teste, porque na hora da demo você
não vai querer digitar `E11100067607`.

---

## Tela 3 — passo a passo com custo

Esta tela é a que mais me interessa, porque ela é o argumento do projeto. Ela
mostra que o custo é uma decisão de arquitetura e não um acidente.

Nove linhas, uma por etapa, cada uma preenchendo ao vivo. O que cada uma diz
já está nos eventos que o fluxo emite hoje:

```
Carregando produto                    ✓   70ms
Validando categoria da semente        ✓   1 chamada      ou  "já estava limpa, 0 chamadas"
Conferindo estoque                    ✓   esgotado
Montando a lista da categoria         ✓   76 em estoque   grátis
Mesmo produto em outra cor            ✓   não encontrado  grátis
Limpando a categoria                  ✓   40 conferidos, 1 saiu, 5 chamadas
Classificando faixa premium           ✓   76 classificados, 0 em cache, 1 chamada
Escolhendo entre a mesma faixa        ✗   13 candidatos, nenhum servia
Abrindo para faixa vizinha            ✓   48 candidatos, 1 escolhido
```

Três coisas que eu quero que essa tela deixe óbvias:

**O que foi de graça.** As etapas determinísticas marcadas como grátis, em cor
diferente. Quando uma semente em estoque resolve em 0,3 segundo e zero
chamada, isso tem que ser visível, não escondido num número agregado.

**O que o cache poupou.** O contador já conta `callsAvoidedByCache`. Na
segunda semente da mesma categoria, "76 classificados" vira "76 em cache, 0
chamadas", e esse é o momento em que a arquitetura se explica sozinha.

**Quando o modelo recusa, e por quê.** A passada 1 recusar não é erro, é o
sistema funcionando. A tela deve mostrar o motivo escrito pelo modelo
("nenhum candidato é console, o cliente queria o console"), porque é isso que
dá confiança de que a passada 2 não é um remendo.

E o custo correndo num canto: chamadas, tokens, e dinheiro quando as tarifas
estiverem configuradas. Separando **custo de escolher** de **custo de gerar a
imagem** — eu suspeito que a geração da imagem vai dominar e que o trabalho de
economia que fizemos hoje vai parecer pequeno ao lado dela. Melhor descobrir
isso no painel do que numa fatura.

---

## Tela 4 — resultado

A lista ranqueada com a justificativa de cada item, do jeito que já sai hoje.
Marcando quais já têm banner pronto, e o aviso quando a opção escolhida não foi
a primeira por causa da regra de reaproveitamento — essa transparência importa,
porque senão ninguém entende por que o segundo colocado foi para a tela.

Idioma escolhido aqui, não antes: dinamarquês, sueco ou inglês. Preço sempre em
DKK, nos três, porque o briefing é explícito — o idioma muda o texto, não o
mercado.

---

## Tela 5 — biblioteca de banners

Os que já foram feitos, com filtro por produto, idioma e campanha. Para cada
um: quantas vezes foi reaproveitado, e se os fatos dele ainda batem com o feed
ou se ele venceu.

Essa tela é também onde se vê se a ideia do cache está pagando.

---

## Pontos abertos

**O texto do banner pode mencionar o produto que a pessoa olhou?** Se puder
("em vez da geladeira que você viu"), o banner deixa de ser reaproveitável,
porque ele fica preso àquela semente. Se não puder, ele fala só do produto
mostrado e serve para qualquer semente que leve a ele. Minha recomendação é
**não mencionar a semente**, justamente para manter o cache possível — mas isso
é decisão de copy e tem que passar pelo guia de tom de voz.

**Quem gera a imagem.** Não decidi nada aqui e é a maior incógnita de custo.
Mas já olhei os dados e as referências, e isso adianta a conversa.

*Imagens de produto:* 28.005 dos 28.231 produtos têm imagem, 99,2%. Só 226 não
têm. Então o bloco de regra "precisa ter imagem" é barato e quase nunca corta
ninguém — mas vale existir, porque banner sem produto não é banner.

*Os 8 banners de referência não são um template só.* São pelo menos dois tipos
diferentes, e só um deles é o nosso:

| tipo | exemplo | tem produto único? | tem preço? |
|---|---|---|---|
| **banner de produto** | `02-dk-mobile-weeks-iphone` | sim | sim, com preço de referência |
| **banner de campanha** | `08-se-tv-helg` | não, vários nas bordas | não, só "até 60%" |

O desafio pede hero de retargeting a partir de um produto semente, então o
nosso é o **primeiro tipo**. Não vale tentar fazer um template que cubra os
dois.

*Anatomia do banner de produto*, lida do `02`:

```
┌──────────────────────┬─────────────────┬──────────────────────┐
│ MANCHETE EM CAIXA    │                 │   ○ selo de campanha │
│ ALTA, COM UMA        │     produto     │   ▣ etiqueta energia │
│ PALAVRA EM VERDE     │   recortado no  │   ▮ bandeira desconto│
│                      │   fundo azul    │                      │
│ linha de apoio       │                 │     5699,-           │
│                      │                 │   antes 7499,-       │
│ ( Comprar )          │                 │   nome + variante    │
└──────────────────────┴─────────────────┴──────────────────────┘
                                            letra miúda legal
```

Três zonas: texto à esquerda, produto ao centro, preço e selos à direita. O que
disso sai do nosso feed, hoje: preço, preço anterior (`Price` +
`SavePriceAmount`), desconto calculado, imagem, nome — e a **etiqueta de
energia**, que eu não tinha percebido que importava e que o feed traz em
`EnergyEfficiencyClass` e `EnergyArrowUrlPng`.

O que **não** sai do feed, e por isso não entra: o banner `02` é oferta com
assinatura, e a letra miúda dele fala de mensalidade e taxa de criação. O
briefing avisa que preço de assinatura e texto legal não podem ser produzidos
a partir do feed. Então esse banner é um bom modelo de *layout* e um mau
modelo de *conteúdo*.

*O texto tem três encaixes, não um.* O guia de copy é explícito: manchete,
linha de apoio e descrição, cada uma com função própria e sem repetir as
outras. Manchete de 30 a 45 caracteres, nunca mais de 60, sem ponto final a
não ser interrogação. Isso significa que o gerador produz **três campos
versionados**, e os três entram na chave do cache de banner.

*Uma validação do trabalho que já fizemos.* O guia de copy diz, com estas
palavras, que "tinta não é papel, e um set de LEGO não é o videogame em que
ele é tematizado". É exatamente o erro que o tagger cometia e que a gente
corrigiu com a regra de núcleo em dinamarquês. O time de copy chegou no mesmo
problema por outro caminho, o que me deixa mais confiante de que categoria
certa é pré-requisito do banner, não detalhe técnico.

**Concorrência.** Hoje o store é um NDJSON reescrito inteiro a cada gravação.
Duas execuções ao mesmo tempo perdem escrita uma da outra. Com interface isso
deixa de ser teórico, porque duas pessoas podem clicar junto. Precisa de fila
por categoria ou de trocar o store por algo transacional antes de ter mais de
um usuário.

**Campanha não existe no feed.** O bloco de regra "campanha de Black Friday"
precisa saber quais produtos estão na campanha, e o feed não tem esse campo.
Então ou vem de uma lista no Firestore, ou de um limite de desconto, ou de
alguém marcar na mão. Isso está detalhado no outro documento.
