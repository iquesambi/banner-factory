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

Resultado: escolher o produto não vai custar token nenhum de modelo. É consulta
numa base já anotada. O único gasto por banner é escrever o texto.

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

## O que ainda falta

**Meu:**

- A recomendação em si — dado o produto semente, escolher o que mostrar
- A geração do banner, 2048 × 768, com o texto nos três idiomas
- A interface e o fluxo sob demanda
- Subir a precisão dos 77,6%; sei quais são os dois casos que faltam
- Conferir as imagens dos produtos antes de desenhar o layout

**Suas, para a gente decidir:**

- Regras de promoção: o que promover, e o que fazer quando não há nada bom
- O que fazer quando o produto semente está sem estoque
- Se o produto mostrado deve ser mais barato, parecido ou mais caro que o semente
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
