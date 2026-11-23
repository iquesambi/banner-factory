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

As execuções anteriores, lidas do storage do Mastra:

```bash
npm run runs
```
