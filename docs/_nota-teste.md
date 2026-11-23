> ## Leia isto antes da tabela
>
> **O prompt do recomendador mudou no meio deste teste.** Na primeira rodada,
> 4 das 8 sementes que completaram voltaram sem recomendação nenhuma. Fui olhar
> e o caso da adega de vinho era indefensável: semente Temptech de 9.990 kr,
> e em estoque havia três adegas Temptech da mesma marca e duas La Sommeliere
> a 9.999 kr com estoque 100+. Ele recusou todas dizendo que nenhuma era
> "próxima o suficiente em tamanho e design".
>
> A culpa era minha. O prompt tinha três frases empurrando para recusar e
> nenhuma para oferecer, e os nomes do feed são pobres demais para confirmar
> tamanho ou capacidade. O resultado era um vendedor dizendo "não tenho nada"
> na frente de quinze adegas.
>
> Separei os dois casos: lista vazia é só para quando nenhum candidato é o
> mesmo **tipo** de produto. Não poder conferir um detalhe é falha do dado, e
> aí a instrução é oferecer e dizer no motivo o que não deu para confirmar.
>
> As quatro recusas viraram recomendação depois disso, e o texto delas passou a
> dizer coisas como *"não consigo confirmar a contagem exata de baterias"*.
>
> **Uma coisa que eu ainda acho discutível e deixo para você:** na adega, ele
> escolheu duas Temptech (mesma marca, +14% e −36%) e **não** escolheu a
> La Sommeliere de 9.999 kr, que está a nove coroas do preço da semente e tem
> estoque 100+. Ele preferiu marca a preço. Defensável dos dois lados, e é
> exatamente o tipo de decisão que as suas regras de negócio vão resolver.
>
> **Limitação desta rodada:** rodei com `--no-validate-pool`, porque o free tier
> do Gemini está devolvendo 503 constantemente e a limpeza de categoria chegou a
> levar 625 segundos numa única semente. Então os candidatos podem conter
> produtos mal classificados que a limpeza teria tirado.
>
> ---
>
> ### Três casos que eu olharia primeiro
>
> **`798372` Razer Kraken V4 Pro → JBL Quantum 910X _Xbox_.** O Razer é
> multiplataforma e o JBL é a variante **Xbox**, que muda o dongle sem fio. O
> motivo escrito diz só "foco gamer semelhante" e não menciona a trava. Isso é
> uma família de problema que o prompt não cobre — plataforma, encaixe de
> lente, tipo de tomada, cartucho de impressora. Não mexi no prompt por causa
> disso, porque é discutível e eu já tinha mudado uma vez no meio do teste. Se
> você achar que é erro, a regra a escrever é genérica: candidato travado em
> plataforma diferente da semente precisa dizer isso no motivo.
>
> **`591881` Miele Professional 59.999 kr → Miele PFD100 por 24.375 kr (−59%).**
> Mesma marca e mesma linha profissional, mas 59% abaixo é outra máquina. Ele
> admite que não confirma a série. Pode ser a melhor opção existente, pode ser
> queda grande demais para um banner.
>
> **`MFCL9570CDW` Brother 8.699 kr → HP Color LaserJet por 11.399 kr (+31%).**
> Única recomendação, e mais cara que a semente. Vale decidir se banner de
> retargeting pode subir de preço.
>
> ### O que funcionou melhor
>
> - **`E11100067607` torneira Grohe** resolveu por variante exata: 1 chamada,
>   325 tokens, outra cor da mesma torneira. Caminho determinístico funcionando
>   no departamento Epoq, que não tem nada de eletrônico.
> - **`977754` robô de limpeza** recebeu dois Eufy Omni mais baratos com estoque
>   50+ e 100+, depois de ter sido resgatado de `foam-roller`.
> - **`998757` iPad Pro 2TB** recebeu o mesmo iPad Pro de 512GB. Mesmo modelo,
>   menos memória, 36% mais barato.
> - **`772336` drone DJI** recebeu outro da **mesma série Avata**, 22% mais
>   barato, depois de ter sido resgatado de `batterier`.
>
> ### Custo das 14
>
> 24 chamadas e 46.834 tokens no total, com 36 chamadas evitadas por cache.
> Três das 14 resolveram com zero ou quase zero custo de modelo: duas por
> variante exata e uma porque a semente estava em estoque.
>
> Uma semente não entrou: `1003265`, o notebook HP. Tentei três vezes e as três
> morreram nos 503 do free tier.
