# O prompt de imagem

O banner passa a ser desenhado pelo Gemini, não pelo meu HTML. Este documento
é o prompt base, de onde ele vem e o que eu acho que vai dar trabalho.

O prompt **não é escrito à mão por banner**. Ele é montado em
`src/banner/image-prompt.ts` a partir do mesmo briefing que alimenta o
renderizador, então os dois nunca podem descrever banners diferentes. Se o
redator muda uma palavra ou o estrategista tira um selo, o prompt muda junto,
sem ninguém lembrar de editar nada.

```bash
npm run brief -- 802582 --no-validate-pool --image-prompt
```

Isso imprime o prompt e grava em `.cache/briefs/<sku>-<idioma>-full.prompt.txt`.
A última linha da saída traz a URL da foto do produto, que você anexa ao colar.

---

## Dois modos, e a diferença é sobre verdade

### `full` — o modelo desenha tudo

O padrão. Uma imagem só, texto incluído, sem composição depois.

É o que você pediu e é o caminho mais simples de integrar. O risco é
específico e eu prefiro nomeá-lo antes de você gastar a tarde: **todo número
no banner passa a ser desenhado por um modelo que não sabe o que é uma coroa.**
O briefing do desafio exige que preço e economia venham do feed e nunca sejam
inventados. Hoje eu garanto isso em código — o preço é escrito a partir do
campo `Price`. Num banner gerado como imagem, `37.998,-` pode voltar como
`37.988,-` e nada no sistema percebe.

Os caracteres dinamarqueses e suecos — æ ø å ä ö — são a segunda fonte de
erro, e aparecem em quase toda frase.

### `scene` — o modelo desenha o cenário, o texto é composto por cima

```bash
npm run brief -- 802582 --no-validate-pool --image-prompt --scene
```

O modelo entrega fundo e produto, com as faixas esquerda e direita vazias. O
texto, o preço e os selos entram depois pelo renderizador, onde vêm do feed e
não podem estar errados.

Você ganha o que o modelo faz bem — iluminação, integração do produto no
fundo, sombra de contato — sem entregar os números a ele.

Os dois modos saem do mesmo briefing, então dá para rodar os dois no mesmo
produto e comparar.

---

## O que vai no prompt

| seção | de onde vem |
|---|---|
| foto do produto | `Image` do feed, anexada à mão por enquanto |
| medidas e margens | medidas nos oito banners de produção |
| paleta | amostrada dos PNGs de produção, não descrita |
| título, apoio, botão | o redator |
| selos e ordem | o estrategista |
| quebra de linha e escala | o diretor de arte |
| preço e economia | o feed, já formatados no estilo dinamarquês |
| condições | a camada de verdade (`facts.ts`) |

A seção final de proibições existe porque modelo de imagem gosta de ajudar:
sem ela vêm selos inventados, estrelas de "oferta", pessoas na cena, reflexo
sob o produto e borda.

---

## Testando no navegador

1. Rode o comando e copie o texto.
2. Baixe a foto do produto pela URL que o comando imprime.
3. No Gemini, anexe a foto **e** cole o prompt.
4. Compare com `examples/production-banners/` lado a lado.

O que eu olharia primeiro, em ordem:

- **Os dígitos do preço.** Um a um, contra o briefing.
- **Os caracteres especiais.** `kølefryseskab`, `stål`, `tilbud`.
- **O produto.** É a foto que você anexou, ou ele redesenhou algo parecido?
  Essa é a falha que mais importa: um banner com uma geladeira que não existe
  no catálogo é pior que um banner feio.
- **A proporção.** Pediu 2048×768; modelos costumam devolver o que querem.
- **O botão.** A sombra verde escura deslocada, sem desfoque.

---

## O primeiro teste de verdade

Rodado no Gemini pelo navegador, com a foto anexada, na geladeira Samsung.

**O texto saiu perfeito.** Era exatamente o que eu tinha apontado como risco, e
não aconteceu: título nas três linhas, destaque em verde na frase certa,
`kølefryseskab`, `rustfrit stål`, `madvarer`, o botão, o nome do modelo
`RF65DG9H0ESREF` — e o preço `37.998,-` com os dígitos certos. Nada inventado.

**E ele achou um erro meu.** O prompt mandava desenhar a seta do selo de
energia apontando para a direita. O Gemini desenhou para a esquerda. Fui medir
nos dois banners de referência que têm o selo: a forma colorida se afina para a
**esquerda** e é reta do lado direito, onde encosta a caixa A↑G. O modelo estava
certo e eu estava errado, nos dois lugares — no prompt e no meu renderizador
HTML, que desenhava a seta invertida desde o começo. Corrigidos os dois.

O que saiu errado, medido:

| | pedido | veio |
|---|---|---|
| tamanho | 2048×768 | **2000×736** |
| fundo | gradiente de `#041752` a `#0e2d7c` | quase todo `#05194c`, com uma emenda diagonal dura |
| verde | `#77be24` | `#78b529` |
| faixa lateral | selo e preço centrados juntos | selo colado no topo, preço bem abaixo |

O fundo é o pior dos quatro: o gradiente perdeu quase toda a amplitude e virou
um bloco escuro com uma dobra visível. Os exemplos têm os dois extremos
presentes em quantidade; o gerado tem só o escuro.

O prompt foi endurecido nos três pontos — tamanho exato em vez de aproximado,
as quatro cores de canto nomeadas uma a uma, e proibição explícita de emenda ou
bloco de cor no fundo.

---

## Integração depois

Quando você puser a chave paga, isso vira um quarto passo no workflow, no mesmo
molde dos outros: agente com retry e contador de custo, resultado gravado, e o
evento `image.generated` no webhook. O modelo de imagem fica em variável de
ambiente, como os outros, porque eu não quero chutar o nome dele aqui — me diga
qual a sua chave libera e eu ligo.

Duas coisas que eu já deixaria decididas antes de ligar:

**O cache de banner muda de preço.** Hoje um banner custa 4 chamadas de texto.
Com geração de imagem ele custa isso mais uma chamada de imagem, que é uma
ordem de grandeza mais cara. A chave de cache que está em
a interface passa a valer muito mais.

**Precisa de um portão antes de publicar.** Se o preço é desenhado, alguém ou
alguma coisa tem que conferir o que foi desenhado. O revisor de marca, que é o
próximo agente, é o lugar natural: ele já vai olhar a imagem final, e dá para
pedir que leia os números de volta e compare com o briefing. É mais frágil que
código, mas é melhor que nada — e com o modo `scene` o problema não existe.
