# Banner Factory — worklog

Onde o trabalho está e como cheguei aqui. O detalhe técnico, com as medições e
os erros do caminho, está em [docs/detalhes-tecnicos.md](docs/detalhes-tecnicos.md).

---

## O problema que eu precisava resolver primeiro

O desafio diz que escolher o produto é o coração de tudo: dado o produto que a
pessoa olhou, qual o melhor produto para mostrar no banner.

Só que o feed tem 28.231 produtos e **nenhum campo de categoria ou de marca**.
São 18 campos, todos texto. Sem saber que um produto é uma TV e o outro é uma
geladeira, não existe como dizer que um combina com o outro.

Então antes de qualquer recomendação eu precisava de uma coisa: categoria e
marca em cada produto.

## O que eu fiz

### Peguei a taxonomia real da Elgiganten

Minha primeira ideia foi inventar uma lista de categorias. Descartei: ia ser um
palpite meu sobre uma loja que eu não conheço.

Em vez disso fui no site. O `robots.txt` da elgiganten.dk aponta um sitemap, e
dentro dele existem dois arquivos que resolvem o problema:

- **723 categorias**, com a hierarquia completa, em 5 níveis e 11 departamentos
- **5.550 marcas**

É a taxonomia oficial da própria loja, de graça, e dá para baixar de novo com um
comando quando quiser atualizar. Está em `data/taxonomy/`.

Isso rendeu mais do que eu esperava: como a árvore tem hierarquia, "quem olhou X
deveria ver Y" fica mensurável como distância na árvore — mesmo pai, mesmo avô,
mesmo departamento. É uma resposta explicável, que é o que o desafio pede.

### Montei o tagger em duas camadas

O nome: `tagger` é o que anota categoria e marca. Deixei `matcher` reservado
para o algoritmo de recomendação, que vem depois.

**Camada 1, de graça.** Passa pelos 28 mil produtos lendo o nome e comparando
com a taxonomia. Roda em 1 segundo e não chama modelo nenhum, então custa zero e
pode rodar quantas vezes eu quiser.

**Camada 2, o modelo.** Quando um produto entra em cena — é o produto semente,
ou aparece numa lista de recomendados — o modelo mais barato confere a categoria
dele. A base vai ficando limpa exatamente onde está sendo usada, e não num
processamento gigante antecipado.

Cada produto guarda em que ponto da limpeza está: nunca visto, categorizado
automaticamente, confirmado pelo modelo, corrigido pelo modelo, ou sem
categoria. Se a taxonomia ou o feed mudarem, as validações antigas são marcadas
como vencidas automaticamente.

### Fiz questão de gastar pouco token

Duas decisões que importam:

**O modelo nunca recebe a descrição do produto.** Descrição longa tem 1.560
caracteres em média; o nome tem 43. E para dizer se algo é uma secadora, o nome
basta. Só isso é 66 vezes menos token.

**O modelo responde com um número, não com um texto.** Ele recebe uma lista
numerada de opções e devolve o índice da que escolheu. São dois tokens de
resposta — e categoria inventada fica impossível, porque se o número não está na
lista é erro detectável, não um texto que parece certo.

Resultado: a anotação da base fica barata e o custo cresce com uso, não com o
tamanho do catálogo.

Uma coisa que eu afirmei aqui antes e que estava errada: eu tinha escrito que
escolher o produto não custaria token nenhum, porque seria consulta numa base
anotada. Deixou de valer quando decidimos que o modelo escolhe. Hoje escolher
custa entre zero e duas chamadas, dependendo do caminho — e os números estão
logo abaixo.

### Depois, escolher o que recomendar

Com categoria e marca na base, já dá para perguntar o que mostrar quando o
produto que a pessoa olhou está esgotado. São nove passos, e a ordem importa
mais do que qualquer um deles:

1. Carrega o produto semente
2. Confere a categoria dele com o modelo — eu vou buscar pela categoria, então
   ela tem que estar certa
3. **Tem estoque? Então ele é a própria resposta.** Custa zero
4. Monta a lista do que está em estoque naquela categoria
5. **O mesmo produto em outra cor, em estoque?** Comparação de texto, custa
   zero, e nenhum modelo escolheria melhor
6. Limpa a categoria, porque o passo seguinte herda erro de categoria
7. Classifica o nível premium da semente e da lista, uma vez por categoria,
   guardado na base
8. Pede a recomendação entre os do mesmo nível
9. Só se isso voltar vazio, abre para um nível acima e um abaixo

Os passos 3 e 5 vêm antes de tudo que custa dinheiro, de propósito. E eles
pegam mais do que eu esperava: o Galaxy Z Fold8 Ultra esgotado tem o mesmo
aparelho, mesma memória, mesmo preço, em outra cor, com estoque.

### O nível premium é diferente de categoria e marca

Categoria tem gabarito: ou é uma secadora ou não é. Marca também, confiro
contra a lista de 5.550. **Nível premium não tem.** Duas pessoas razoáveis
discordam se uma Bosch de 12.000 kr é média ou alta.

Então medi de outro jeito. O modelo nunca vê o preço — ele julga pelo nome,
pela marca e pela linha. Depois eu comparo o nível que ele deu com o preço
real que ele não viu:

| categoria | produtos | correlação nível × preço |
|---|---|---|
| geladeira com freezer | 98 | 0,66 |
| celular | 251 | 0,75 |

Perto de zero seria ruído. Perto de 1 seria o nível só repetindo o preço, sem
acrescentar nada. No meio é o que eu queria: concorda com o mercado e traz um
eixo novo.

Rodei a mesma lista em dois modelos diferentes: **86,7% de nível idêntico, e
nunca mais de um nível de diferença.** Para um atributo sem gabarito, isso é o
que importa — a régua não precisa estar certa no absoluto, precisa ser a mesma
sempre, porque eu só uso ela para comparar semente com candidato.

## Depois de escolher o produto, escrever o banner

Dois agentes novos, nessa ordem: o **redator** escreve título, subtítulo e
botão, e o **diretor de estratégia** olha o que foi escrito e decide quais
selos entram. O diretor de arte e o revisor vêm depois e ainda não existem.

A ordem não é arbitrária. O guia de copy da marca pede que cada linha carregue
a própria ideia e que elas não se repitam. Um selo de economia ao lado de um
título que já diz "economize 24.000" quebra essa regra do mesmo jeito que duas
linhas iguais quebrariam, e só quem leu o texto consegue perceber. Rodando o
estrategista depois do redator, ele pega isso — e pegou, no primeiro teste.

### A camada de verdade é código, não prompt

O briefing exige que tudo no banner seja verdade. Exigência que não admite
exceção não vai para um texto que o modelo reinterpreta. Então
`src/banner/facts.ts` decide o que **pode** existir, e o modelo decide o que
**vale a pena**. É a mesma divisão das regras de negócio.

O que a camada bloqueia, medido neste catálogo:

| situação | quantos | o que acontece |
|---|---|---|
| feed discorda de si mesmo sobre a economia | 56 | nenhum selo de economia |
| preço anterior menor que o atual | 3 | idem, com a razão explícita |
| `Klubpris` | 17 | preço de membro só com a condição escrita junto |
| `Maks n` | 11 | vira restrição que a copy não pode contradizer |
| `Pris ex. Pant`, `Uden frontplade` | 12 | idem |

E uma checagem que transforma "nunca invente um preço" em algo verificável:
todo número que aparece na copy é comparado com a lista de números permitidos
— o preço, a economia, o preço anterior e os números do próprio nome do
produto. Número sem fato por trás reprova o rascunho, e o redator é chamado de
novo com o motivo da reprovação, não com o mesmo pedido.

### O que os testes mostraram

A TV TCL de 85", que tem energia e economia consistente: o redator escreveu
"Spar 24000 kr på det store TCL 85" TV" (37 caracteres) e o estrategista
**recusou o selo de economia**, dizendo que o título já carregava. Deixou só o
selo de energia. Duas chamadas, 1.865 tokens.

O teclado SteelSeries com `Klubpris`, que é o caso mais difícil do catálogo:
título "SteelSeries Apex Pro TKL Gen 3 til 1499 kr for medlemmer", subtítulo
dizendo que custa 2299 sem associação, e letra miúda com a condição. Os dois
números verdadeiros e a condição explícita.

A caixa de Pokémon com limite de 3 por cliente: nenhum selo disponível, então o
estrategista **não foi chamado** — uma chamada só. O subtítulo cita o limite em
vez de ignorá-lo.

### Um vazamento que só apareceu rodando

O banner em inglês voltou com o botão **"Køb nu"**, em dinamarquês. Depois, o
sueco escreveu "Spar" em vez de "Spara". Dinamarquês e sueco são próximos o
bastante para as palavras atravessarem sem parecer erradas — para um sueco
parecem.

O botão virou vocabulário fechado por idioma, validado em código, porque é o
único campo que não carrega fato nenhum e a marca repete as mesmas palavras em
todo banner. O resto foi resolvido nomeando a armadilha no prompt: spara e não
spar, erbjudande e não tilbud, ö e ä onde o dinamarquês usa ø e æ. Depois
disso, "Spara 24000 kr".

## O banner, desenhado

O diretor de arte fecha a corrente. Ele recebe o briefing pronto e decide
**duas coisas**: onde o título quebra em linhas, e quão grande o produto
aparece. Mais nada.

Essa fronteira é deliberada. A grade, a paleta, a tipografia e o bloco de
preço são fatos de marca medidos, e pedir a um modelo que os reproduza só
cria um jeito de eles saírem errados. O que sobra é julgamento de verdade, e
é o que todo banner de referência mostra alguém decidindo: "DET ER PERFEKT
AT / OPGRADERE LIGE NU" é uma escolha, e nenhuma regra que eu consiga
escrever quebra bem uma frase arbitrária em três idiomas.

Tudo que ele devolve é conjunto fechado ou é conferido contra a copy. As
linhas têm que recompor o título palavra por palavra, e a frase em destaque
tem que caber inteira numa linha — senão o verde ficaria partido no meio.

### Medir em vez de supor

Não havia biblioteca de imagem instalada, então escrevi um leitor de PNG em
cima do `zlib` e amostrei os oito banners de produção pixel a pixel:

| | |
|---|---|
| fundo | faixa diagonal, `#0e2d7c` no meio e `#041752` nas pontas |
| verde | `#77be24` — destaque do título **e** botão |
| rosa | `#ed3089` |
| amarelo | `#fdf100` |

Isso derrubou uma suposição: eu tinha achado um segundo verde, `#05a54d`, e
ia usar no botão. Amostrando a região exata da pílula nos quatro banners, ela
é `#77be24` em todos — o `#05a54d` é o verde de dentro do rótulo de energia
classe A, que não é cor de marca.

### O recorte do produto

As fotos do feed são JPEG com fundo branco e sem margem. Branco colado no
azul vira uma caixa. Tirar todo pixel claro fura o produto por dentro: some o
logo Samsung, somem os ícones da tela.

O que funciona é **preencher a partir da borda**: só o branco conectado à
moldura é fundo. O branco de dentro sobrevive. Depois uma passada suaviza a
silhueta, senão fica um halo claro contra o azul.

Isso roda dentro da página, em canvas, porque o CDN não manda cabeçalho CORS
— a imagem é baixada primeiro e o Chrome lê os pixels em modo local.

### Como é rasterizado

Chrome headless, que já estava na máquina, em 2048×768. Isso dá moldagem de
texto de verdade com as OTF da marca, que é justamente o que um SVG escrito à
mão erraria. O caminho do binário sai de `CHROME_PATH`.

### A margem, medida em vez de arbitrada

O primeiro banner saiu com a geladeira encostando em cima e cortada embaixo.
Em vez de chutar um valor, medi a caixa do produto nos banners de referência:

| | topo | base | altura |
|---|---|---|---|
| iPhone | 64px | 9px | 90% da tela |
| iPad | 60px | 59px | 85% |
| eletrodomésticos | 169px | 78px | 68% |

E o texto: x 77..690, a lateral x 1516..1970. **A margem segura é 78px**, e as
faixas passaram a ser essas medidas em vez das minhas estimativas.

O achado que importa é outro: **em nenhum dos oito o produto é cortado pela
borda**. A opção de sangra que eu tinha dado ao diretor de arte era invenção
minha, não algo que a marca faz, e era exatamente ela que produzia o corte.
Saiu do schema. Agora o produto cabe sempre inteiro, e a escala escolhe quanto
do espaço disponível ele ocupa — nunca se ele vaza.

### O que eu tinha errado por não olhar direito

Três coisas, todas apontadas olhando o banner ao lado dos exemplos.

**O logo.** Eu tinha posto um Elgiganten no canto superior direito. **Nenhum
dos oito banners de produção tem logo** — eles rodam dentro de uma página que
já traz o logo no cabeçalho. Os arquivos existem em `brand/`, mas não vão no
banner. Saiu.

**O botão tem profundidade.** Não é uma pílula lisa: há uma segunda, em verde
escuro `#096729`, deslocada para baixo e para a direita. Medido em dois
banners: +10px num, +7px no outro. E o texto dentro é azul-marinho, não verde
escuro como eu tinha posto.

Minha primeira tentativa foi um segundo elemento posicionado absoluto, e saiu
errado de um jeito instrutivo: a largura de um absoluto é limitada pelo
contêiner menos o `left`, então a pílula de trás ficou mais estreita e muito
mais baixa que a da frente. Virou `box-shadow` sem desfoque, que segue o raio
da borda de graça.

**Estava tudo pequeno demais.** Medindo os exemplos: o selo de energia tem
161×111 e 188×130 — eu tinha feito um terço disso. A barra amarela tem 65 a
88px de altura. O preço tem 90 a 120px de altura de letra. E a barra amarela
**cola no preço**, 17 a 26px de distância, enquanto o selo de energia fica
bem solto. Eu tinha espaçamento uniforme de 18px entre tudo.

### Três defeitos que só apareceram olhando o PNG

O primeiro foi meu: a checagem rejeitava o título devolvido em caixa alta,
embora o CSS faça `text-transform: uppercase` de qualquer jeito. Comparar
ignorando a caixa resolveu.

O segundo foi o mesmo erro pelo avesso. Deixei a checagem insensível à caixa
e esqueci o render, então o destaque verde sumiu do banner inteiro sem
reprovar nada. Agora os dois comparam igual.

O terceiro foi a quebra `RIGTIG / god plads til alle / dine indkøb`, com uma
palavra sozinha na primeira linha — exatamente o que as instruções proíbem.
Virou checagem: linha de uma palavra só, ao lado de linhas muito maiores,
reprova e volta com o motivo.

Depois ainda apareceram dois de formatação, também só olhando: o selo dizia
`330 KR (13%)` e o preço anterior `Før 2529,-`, sem ponto de milhar. O número
agora viaja como número até o renderizador, que o escreve no estilo da marca —
`SPAR 330,-`, `Før 2.529,-` — e a palavra do selo tem tabela por idioma, pelo
mesmo motivo do botão.

E uma faixa branca de cinco pixels na base, que não reproduziu numa segunda
renderização. Artefato de pintura intermitente é pior que um fixo, porque
passa despercebido: o fundo padrão do Chrome passou a ser o azul escuro do
próprio banner, então o mesmo escorregão fica invisível.

## A interface, em Next.js

As cinco telas desenhadas viraram aplicação, ligada nos agentes e workflows
que já existiam. Nada do motor foi reescrito: `app/` chama `src/` direto.

| rota | o que faz |
|---|---|
| `/` | busca por nome **e SKU** nos 28.231 produtos, fila de cards com idioma |
| `/board` | quadro kanban, cards andando pelas colunas conforme os eventos |
| `/board/[id]` | o card aberto: passo a passo, custo por etapa, banner, polegares |
| `/rules` | as três faixas e o laboratório de ensaio |
| `/banners` | o acervo, com validade conferida contra o feed de hoje |

### Como os eventos chegam na tela

O fluxo já emitia um evento por etapa e sabia mandar para webhook. Para a
interface, que roda no mesmo processo, pedir por HTTP ao próprio servidor
seria latência e um modo de falha a troco de nada. Então `src/events`
ganhou **assinatura em processo**: `onRunEvent(runId, fn)`.

O que torna isso possível é que `createRun()` devolve o `runId` **antes** do
`start()`, então dá para assinar enquanto o primeiro evento ainda não
aconteceu. O webhook continua lá, para quem está fora do processo.

A tela, por enquanto, faz *polling* de um segundo. O desenho previa o
Firestore recebendo o webhook e o cliente escutando o documento; a troca é um
hook quando o Firebase existir.

### Quatro defeitos que só o build encontrou

**`createRun` perdeu o receptor.** Nos CLIs eu escrevia
`(workflow.createRun as T)()` — parênteses em torno de um acesso a membro
**não** desligam o receptor, então funcionava. No runner eu guardei em
variável, e aí desligou: o Mastra morreu em
`Cannot read properties of undefined (reading 'takeNestedRun')`, porque
`createRun` lê um campo privado. Um erro que só aparece quando o mesmo código
muda de forma.

**`new URL('../..', import.meta.url)`** no renderizador: o webpack reescreve
esse padrão como referência a arquivo e depois falha ao resolver `'../..'`
como módulo. A raiz passa a vir de `process.cwd()`, com `BANNER_ROOT` para
quem rodar de outro lugar.

**O `next.config.ts` não carrega.** O Next lê um config TypeScript pela API
do compilador, e o compilador 7 não a expõe. Virou `.mjs`.

**O projeto estava no TypeScript 7**, que o Next não suporta em lugar nenhum
do seu pipeline. Desci para 5.9.3 e o motor inteiro continua passando — e o
compilador 5 ainda achou um erro de verdade que o 7 deixou passar: uma página
do Next não pode exportar nada além da página, e eu exportava um componente
de dentro de `app/page.tsx`.

### O que não está pronto, e é bom dizer

- **Um banner completo precisa de crédito na API.** A corrente roda inteira e
  para no 402 da conta, que aparece em uma linha no card.
- **As regras não estão ligadas no fluxo.** O laboratório lê o catálogo real e
  fala a verdade sobre ele — ligar `Minimum stock 25+` zera a geladeira e risca
  os 12 candidatos na hora, sem gastar chamada — mas o `recommend` ainda monta
  a pool com as mesmas regras no código.
- **Sem Firebase.** Não há login, as execuções ficam em arquivo e o quadro
  consulta em vez de escutar.
- **Os blocos não arrastam**: ligam e desligam. A ordem dentro da faixa não
  muda nada hoje, então arrastar seria enfeite.

## Onde está hoje

| | |
|---|---|
| Marca identificada | 83,3% dos produtos |
| Categoria pela camada grátis | 59,6% |
| Precisão dessa categoria | 77,6% |
| Tempo da passada completa | ~1 segundo |
| Produtos por chamada ao modelo | 10 em lote |

Os 40% que a camada grátis não resolve, o modelo preenche quando o produto
aparece. Nos testes ele colocou 100% deles em algum lugar.

E o custo de recomendar, medido em execuções reais:

| caminho | chamadas | tokens | tempo |
|---|---|---|---|
| semente em estoque | **0** | 0 | 0,3s |
| mesmo produto em outra cor | **1** | 314 | 5s |
| categoria nova, primeira vez | 7 | 11.007 | 130s |
| mesma categoria, depois | **1** | 940 | 7s |

A última linha é o ponto do desenho. O nível premium fica gravado na base, e a
segunda pergunta na mesma categoria custa um décimo da primeira.

Cada execução também conta o próprio custo em tokens — vindos do contador do
próprio Gemini, não estimados — e emite um evento por etapa, que vai para um
webhook se você configurar um. É o que a interface vai consumir para mostrar
em que passo o banner está.

## O que eu aprendi errando

Vale contar porque mudou o jeito de trabalhar.

**Eu estava medindo a coisa errada.** Nas primeiras versões eu só olhava
cobertura — quantos produtos recebiam alguma categoria. Fui de 47% para 68% e
fiquei satisfeito. Mas nunca medi se a categoria estava **certa**. Era
impressão, não medição.

Aí montei um teste que sorteia produtos, manda para o modelo e compara. Na
primeira rodada ele me mostrou isto:

> **Todo celular do catálogo estava classificado como controle de videogame.**

A categoria real da loja se chama "controles para PC e smartphone". Minha regra
olhava a última palavra para decidir do que a categoria tratava, e a última
palavra era "smartphone". Então todo iPhone, todo Galaxy, todo Honor caía ali.

O mesmo defeito fazia a lâmpada do Pikachu virar LEGO e a caneca do Harry Potter
virar LEGO, porque a loja tem categorias "LEGO do Pokémon" e "LEGO do Harry
Potter".

Era uma regra só. Em dinamarquês, quando a categoria tem várias palavras, o
importante vem na frente, não no fim. Corrigi e a precisão foi de 54% para 69%.

**A lição que levei:** sem um número de precisão, eu estava otimizando no escuro
e piorando sem saber. Hoje o teste roda com uma semente, então qualquer medição
é reproduzível, e ele reporta a margem de erro em vez de um número redondo —
com 50 produtos de amostra, 77,6% quer dizer algo entre 65% e 86%, e falar só o
77,6% seria vender mais confiança do que eu tenho.

**O filtro de nível jogou fora a resposta certa.** Eu tinha feito o nível
premium como portão: só candidato do mesmo nível chegava ao modelo. Numa
geladeira Fisher & Paykel de 45.719 kr esgotada, o modelo recusou todos os
candidatos, e estava certo — nenhum era French Door nem inox.

Só que existia no catálogo um Samsung French Door inox de 37.998 kr, em
estoque, 17% mais barato. Substituto quase perfeito. O filtro cortou ele
porque o modelo tinha dado um nível abaixo. O modelo acertou, o portão errou.

Hoje o nível vai **visível** para o modelo em vez de filtrar antes dele, e
quando o mesmo nível não resolve a pergunta é refeita com um nível a mais de
cada lado. Com isso o Samsung voltou a aparecer e foi escolhido em primeiro.

**O tamanho do lote mudava a resposta.** Classificando 98 geladeiras em lotes
de 25, o nível mais alto tinha 7 produtos. As mesmas 98 numa chamada só: 12. A
culpa era de uma instrução minha, "use a escala toda" — dentro de uma fatia de
25 isso força uma distribuição daquela fatia, não da categoria.

Consertei mandando a categoria inteira numa chamada e dando a lista de todas as
marcas da categoria como referência fixa. Ficou mais consistente e, de bônus,
mais barato: as instruções vão uma vez em vez de quatro.

**E uma correção de rumo:** eu tinha começado a decidir coisas que não são
minhas — o que serve ou não para banner, o que conta como promoção. Tirei tudo.
Hoje o tagger faz três coisas e só elas: categoria, marca e a conta do desconto.
O resto do feed ele carrega como está.

## Decisões

| | O quê | Por quê |
|---|---|---|
| 1 | Taxonomia e marcas vindas do site, não inventadas | é a real da loja, é de graça e dá para atualizar |
| 2 | Workflow do Mastra, não agente, para o enriquecimento | o passo a passo é conhecido; agente gastaria token para redescobrir o fluxo |
| 3 | Camada grátis primeiro, modelo só onde o produto é usado | custo cresce com uso, não com tamanho do catálogo |
| 4 | Modelo escolhe de uma lista fechada e responde um número | mais barato e sem risco de categoria inventada |
| 5 | Nunca mandar descrição ao modelo | 66× mais caro sem melhorar a classificação |
| 6 | Lote de 10 produtos por chamada | o free tier do Gemini limita a 15 chamadas por minuto |
| 7 | Tabela de sinônimos curada para 10 categorias | o feed escreve "smartphone" e a taxonomia diz "mobiltelefon"; comparar texto nunca cruza sinônimo |
| 8 | Medir precisão com amostra e margem de erro | sem isso eu otimizo no escuro, e já aconteceu |
| 9 | Nível premium nunca vê o preço | se vê, só repete o preço; sem ver, dá para conferir um contra o outro |
| 10 | Nível vai visível ao modelo, não filtra antes dele | como portão ele cortou o melhor substituto do catálogo |
| 11 | Passos de graça antes de qualquer passo pago | produto em estoque e mesma cor resolvem muito caso sem gastar nada |
| 12 | Modelo responde índice e lista vazia é a recusa | número fora da lista é erro detectável; prosa dizendo "não" o workflow teria que interpretar |
| 13 | Nível guardado na base com a categoria em que foi julgado | só é comparável ali; se a categoria muda, o nível vence |
| 14 | Storage do Mastra para o histórico de execuções | o catálogo continua em NDJSON porque eu leio na mão; o que o motor fez, não |
| 15 | Variante exata ignora o parêntese inteiro, material incluído | cadeira de tecido entra como variante da de couro; perguntei e a resposta foi deixar como está |
| 16 | O que pode ir no banner é código; o que vale a pena é prompt | verdade do briefing não admite reinterpretação, e escolha editorial não cabe em regra |
| 17 | Estrategista roda depois do redator e lê a copy | selo que repete o título desperdiça o único espaço que carregaria uma segunda ideia |
| 18 | Botão sai de lista fechada por idioma | banner em inglês voltou com botão em dinamarquês, e nenhuma instrução evitou |
| 19 | Rascunho reprovado volta com o motivo, não com o mesmo pedido | pedir de novo igual reproduz o mesmo rascunho |
| 20 | Diretor de arte decide só quebra de linha e escala do produto | grade, cor e tipo são fatos medidos; pedir ao modelo só cria jeito de sair errado |
| 21 | Cores e medidas lidas dos PNGs de produção, não descritas | derrubou minha suposição sobre a cor do botão |
| 22 | Recorte por preenchimento desde a borda | tirar todo branco fura o produto; só o branco ligado à moldura é fundo |
| 23 | Chrome headless rasteriza o HTML | moldagem de texto real com as OTF da marca, sem dependência nova |
| 24 | O produto nunca é cortado pela borda | nenhum dos oito banners de referência corta; a sangra era invenção minha e foi o que estragou o primeiro |
| 25 | Margem segura de 78px, medida nos banners | texto em x 77..690 e lateral em x 1516..1970 nos dois banners com preço |
| 26 | Valor do selo viaja como número até o render | só assim dá pra escrever no estilo da marca, com ponto de milhar e vírgula-traço |
| 27 | Banner não leva logo | nenhum dos oito exemplos tem; o logo é do cabeçalho da página |
| 28 | Botão é pílula com sombra dura em verde escuro | medido +7 e +10px nos exemplos; elemento absoluto atrás sai estreito e torto |
| 29 | Tamanhos de selo, barra e preço vêm de medição | eu tinha feito o selo de energia com um terço do tamanho real |
| 30 | Prompt de imagem é montado do briefing, não escrito à mão | redator muda uma palavra e o prompt muda junto, sem ninguém lembrar |
| 31 | Dois modos: `full` e `scene` | em `full` o preço passa a ser desenhado por um modelo; `scene` deixa os números no código |
| 32 | A seta do selo de energia aponta para a ESQUERDA | medido nos dois exemplos que têm selo; eu desenhava invertido no HTML e mandava invertido no prompt |
| 33 | Eventos por assinatura em processo, webhook mantido | o servidor que roda o fluxo não deveria mandar HTTP para si mesmo |
| 34 | Jobs em arquivo, quadro por polling | sem Firebase ainda; a forma do documento é a mesma que o Firestore vai receber |
| 35 | TypeScript 5.9 em vez de 7 | o Next não suporta o 7 em nenhuma etapa, e o 5 achou um erro que o 7 deixou passar |

## O que ainda falta

**Meu:**

- A geração do banner, 2048 × 768, com o texto nos três idiomas
- A interface e o fluxo sob demanda
- Subir a precisão dos 77,6%; sei quais são os dois casos que faltam
- Conferir as imagens dos produtos antes de desenhar o layout
- A categoria de celular tem 18% de coisa que não é celular: capinha, película,
  boneco de segurar o telefone. O nível premium herda esse erro — uma película
  ZAGG de 299 kr volta como linha alta, porque entre películas ela é linha alta
  mesmo. O recomendador é tão bom quanto o tagger embaixo dele

**Suas, para a gente decidir:**

- Regras de promoção: o recomendador hoje nem vê desconto, de propósito. Ele
  escolhe por mérito e o desconto entra depois, na sua regra
- Qual das opções ranqueadas vai para o banner. O fluxo devolve uma lista com
  justificativa em cada item; escolher dentro dela é regra de negócio
- O desempate entre dois produtos idênticos em cores diferentes. Hoje o padrão
  é estoque mais fundo primeiro, e isso é um palpite meu, não uma regra
- Se os quatro perfis de cliente das referências de design entram na lógica
- Urgência no texto: o guia de copy proíbe, mas um banner de produção diz
  "última chance"

## Rodando

```bash
npm install
cp .env.example .env    # e põe a chave do Gemini
npm run tag             # anota o catálogo inteiro, de graça
npm run eval:sample -- --seed=7 --size=25
```

Recomendar, dado um produto semente:

```bash
npm run recommend -- 802582
```

Vários de uma vez, e cada um grava um .json completo em `.cache/runs/`:

```bash
npm run recommend -- 1116833 498120 802582
```

A corrente inteira — semente entra, banner 2048×768 sai em `.cache/banners/`:

```bash
npm run brief -- 802582 --no-validate-pool
```

Parando no briefing, sem desenhar:

```bash
npm run brief -- 802582 --no-validate-pool --no-render
```

O prompt pro gerador de imagem do Gemini, montado a partir do briefing:

```bash
npm run brief -- 802582 --no-validate-pool --image-prompt
```

Escrever a copy e decidir os selos de um produto:

```bash
npm run compose -- 1083310
```

Nos três idiomas de uma vez:

```bash
npm run compose -- 1083310 --lang=da --lang=sv --lang=en
```

As execuções anteriores, lidas do storage do Mastra:

```bash
npm run runs
```
