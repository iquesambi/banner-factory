# Teste de recomendação — sementes para avaliar

Cada seção é uma semente esgotada e o que o fluxo recomendou, com a
justificativa que o modelo deu. A coluna **Vale?** é para você preencher.

Gerado por `npm run report`. Os dados brutos de cada execução estão em
`.cache/runs/`.

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

## Resumo

| sku | semente | preço | decisão | nº | 1ª recomendação | chamadas | tokens |
|---|---|---|---|---|---|---|---|
| `1116833` | Samsung Galaxy Z Fold8 Ultra smart | 21.999 kr | `exact-variant` | 2 | Samsung Galaxy Z Fold8 Ultra s (0%) | 0 | 0 |
| `1118606` | Nintendo Switch 2 spillekonsol (Po | 4.299 kr | `model-widened` | 1 | Nintendo Switch 2 spilkonsol (-12%) | 4 | 10721 |
| `498120` | Bosch Serie 4 French Door Kølefrys | 18.998 kr | `seed-in-stock` | 1 | Bosch Serie 4 French Door Køle (0%) | 0 | 0 |
| `591881` | Miele Professional Opvaskemaskine  | 59.999 kr | `model-same-tier` | 3 | Miele Professionel Opvaskemask (-59%) | 2 | 5466 |
| `772336` | DJI Avata 2 dronesæt (grå, 3 batte | 9.299 kr | `model-same-tier` | 2 | DJI Avata 360 Fly Mere RC 2 dr (-22%) | 1 | 1065 |
| `773630` | Temptech Oslo vinskab OX30DRW-24 | 9.990 kr | `model-same-tier` | 2 | Temptech Sommelier vinkøleskab (+14%) | 1 | 1174 |
| `798372` | Razer Kraken V4 Pro trådløse gamin | 3.599 kr | `model-same-tier` | 2 | JBL Quantum 910X Xbox gaming-h (-36%) | 4 | 13062 |
| `802582` | Fisher & Paykel French door kølefr | 45.719 kr | `model-same-tier` | 1 | Samsung French Door Kølefryses (-17%) | 1 | 939 |
| `881547` | Smeg Victoria French Door Kølefrys | 37.495 kr | `model-same-tier` | 1 | Smeg 50's Style Kølefryseskab  (-43%) | 1 | 962 |
| `977754` | Dreame Aqua 10 Ultra Roller rengør | 9.699 kr | `model-same-tier` | 3 | Eufy Omni E28 robotstøvsuger T (-7%) | 1 | 1149 |
| `994805` | PlayStation 5 Pro 2TB spillekonsol | 7.099 kr | `model-widened` | 2 | PlayStation 5 Slim Standard Ed (-22%) | 4 | 4310 |
| `998757` | iPad Pro 13" (M5) 2TB WiFi + 5G (S | 27.499 kr | `model-same-tier` | 1 | iPad Pro 13" (M5) 512GB WiFi + (-36%) | 3 | 6627 |
| `E11100067607` | Grohe Red II Duo C vandhane med ko | 18.995 kr | `exact-variant` | 2 | Grohe Red II Duo C vandhane me (-5%) | 1 | 325 |
| `MFCL9570CDW` | Brother MFC-L9570CDW AIO farvelase | 8.699 kr | `model-same-tier` | 1 | HP Color LaserJet Professional (+31%) | 1 | 1034 |

14 sementes · 14 com recomendação · 24 chamadas · 46834 tokens · 36 chamadas evitadas por cache

---

## `1116833` — Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (violet shadow)

- **21.999 kr**, estoque esgotado, faixa —
- categoria `mobil-tablet-smartwatch/mobiltelefon`, marca samsung
- decisão **`exact-variant`** · 0 chamadas · 0 tokens · 0s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (graphite) | 21.999 kr | 0% | 5+ | — | The same product, in stock, in a different variant. |  |
| 2 | Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (cream) | 21.999 kr | 0% | <5 | — | The same product in another variant. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched</sub>

## `1118606` — Nintendo Switch 2 spillekonsol (Pokémon Pokopia bundle)

- **4.299 kr**, estoque esgotado, faixa 2
- categoria `gaming/spillekonsol-tilbehor/nintendo-switch`, marca nintendo
- decisão **`model-widened`** · 4 chamadas · 10721 tokens · 140s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Nintendo Switch 2 spilkonsol | 3.799 kr | -12% | 100+ | 1 | This gives you the exact same Nintendo Switch 2 console without the Pokémon Pokopia bundle extras, and it costs less. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → model.retry → model.retry → model.retry → model.retry → tier.completed → model.retry → recommend.pass1 → recommend.pass2</sub>

## `498120` — Bosch Serie 4 French Door Kølefryseskab KFN96APEA (inox)

- **18.998 kr**, estoque 50+, faixa 2
- categoria `hvidevarer/koleskabe-fryseskabe/kolefryseskab`, marca bosch
- decisão **`seed-in-stock`** · 0 chamadas · 0 tokens · 0s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Bosch Serie 4 French Door Kølefryseskab KFN96APEA (inox) | 18.998 kr | 0% | 50+ | 2 | The product the customer was looking at is in stock. |  |

<sub>etapas: seed.validated → stock.checked</sub>

## `591881` — Miele Professional Opvaskemaskine PFD 404 (hvid)

- **59.999 kr**, estoque esgotado, faixa 3
- categoria `hvidevarer/opvaskemaskine`, marca miele
- decisão **`model-same-tier`** · 2 chamadas · 5466 tokens · 24s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Miele Professionel Opvaskemaskine PFD100 (hvid) | 24.375 kr | -59% | 25+ | 3 | This is another professional Miele dishwasher in white, though we cannot confirm the exact series match. |  |
| 2 | ASKO Professional Opvaskemaskine DWC67423BIW (hvid) | 24.495 kr | -59% | 5+ | 3 | This is a professional dishwasher in white from ASKO, offering a similar aesthetic and professional tier. |  |
| 3 | ASKO Professional Opvaskemaskine DWCFS5936S (rustfri stål) | 40.488 kr | -33% | <5 | 3 | This is another professional dishwasher option from ASKO, though it comes in a stainless steel finish instead of white. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → model.retry → tier.completed → recommend.pass1</sub>

## `772336` — DJI Avata 2 dronesæt (grå, 3 batterier)

- **9.299 kr**, estoque esgotado, faixa 2
- categoria `sport-fritid-hobby/droner-tilbehor/drone`, marca dji
- decisão **`model-same-tier`** · 1 chamadas · 1065 tokens · 14s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | DJI Avata 360 Fly Mere RC 2 drone | 7.299 kr | -22% | 5+ | 2 | This is the same Avata series and includes an expanded flying kit, though I cannot confirm the exact battery count. |  |
| 2 | DJI Avata 360 RC 2 drone | 5.599 kr | -40% | 5+ | 2 | This gives you the same Avata drone with an RC 2 controller, but you drop the extra bundle gear and save money. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → tier.completed → recommend.pass1</sub>

## `773630` — Temptech Oslo vinskab OX30DRW-24

- **9.990 kr**, estoque esgotado, faixa 2
- categoria `hvidevarer/vinkoler-vinkoleskab`, marca temptech
- decisão **`model-same-tier`** · 1 chamadas · 1174 tokens · 2s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Temptech Sommelier vinkøleskab SOMZ45SB (integreret 24 flasker) | 11.390 kr | +14% | 5+ | 2 | It shares the same Temptech brand and a similar compact built-in size. |  |
| 2 | Temptech Sommelier vinkøleskab SOMX15SRB-24 (integreret 6 flasker) | 6.390 kr | -36% | 5+ | 2 | It is also a compact built-in model from Temptech, though with a smaller capacity and lower price. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → tier.completed → recommend.pass1</sub>

## `798372` — Razer Kraken V4 Pro trådløse gaming-høretelefoner (sort)

- **3.599 kr**, estoque esgotado, faixa 2
- categoria `tv-lyd-smart-home/horetelefoner-tilbehor/horetelefoner`, marca razer
- decisão **`model-same-tier`** · 4 chamadas · 13062 tokens · 112s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | JBL Quantum 910X Xbox gaming-høretelefoner | 2.289 kr | -36% | 5+ | 2 | This is a premium wireless gaming headset from JBL offering a similar gaming focus at a lower price. |  |
| 2 | Asus ROG Delta II gaming høretelefoner (sort) | 1.429 kr | -60% | 50+ | 2 | This is another premium wireless gaming headset from ASUS ROG tailored specifically for gaming. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → model.retry → model.retry → tier.completed → recommend.pass1</sub>

## `802582` — Fisher & Paykel French door kølefryseskab RS90A3 (rustfrit)

- **45.719 kr**, estoque esgotado, faixa 3
- categoria `hvidevarer/koleskabe-fryseskabe/kolefryseskab`, marca fisher paykel
- decisão **`model-same-tier`** · 1 chamadas · 939 tokens · 14s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Samsung French Door Kølefryseskab RF65DG9H0ESREF (rustfrit stål) | 37.998 kr | -17% | <5 | 3 | It shares the same French door design and stainless steel finish while costing significantly less. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → tier.completed → model.retry → recommend.pass1</sub>

## `881547` — Smeg Victoria French Door Kølefryseskab FQ960PB6 (pastelblå)

- **37.495 kr**, estoque esgotado, faixa 3
- categoria `hvidevarer/koleskabe-fryseskabe/kolefryseskab`, marca smeg
- decisão **`model-same-tier`** · 1 chamadas · 962 tokens · 1s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Smeg 50's Style Kølefryseskab FAB32RPB6 (pastelblå) | 21.495 kr | -43% | <5 | 3 | This Smeg 50's Style model shares the exact same pastelblå colour and brand identity, though it is a standard fridge-freezer rather than a French Door design. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → tier.completed → recommend.pass1</sub>

## `977754` — Dreame Aqua 10 Ultra Roller rengøringsrobot R9535H (sort)

- **9.699 kr**, estoque esgotado, faixa 2
- categoria `hjem-have/rengoring/robotstovsuger`, marca dreame
- decisão **`model-same-tier`** · 1 chamadas · 1149 tokens · 2s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Eufy Omni E28 robotstøvsuger T2352G11 (sort) | 8.999 kr | -7% | 50+ | 2 | This premium Eufy Omni robot vacuum shares the high-end cleaning capabilities you are looking for at a lower price point, though I cannot confirm if it features the exact same roller mopping system. |  |
| 2 | Eufy Omni E25 robotstøvsuger T2353G11 (sort) | 8.499 kr | -12% | 100+ | 2 | This alternative Eufy Omni model delivers advanced automated cleaning performance for a slightly lower investment, although exact specifications may vary. |  |
| 3 | Karcher RCV 5 robotstøvsuger 12696400 (Hvid) | 4.599 kr | -53% | 5+ | 2 | This Karcher robot vacuum offers automated floor cleaning at an even more affordable price, though it sits at a different feature tier. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → tier.completed → recommend.pass1</sub>

## `994805` — PlayStation 5 Pro 2TB spillekonsol

- **7.099 kr**, estoque esgotado, faixa 2
- categoria `gaming/spillekonsol-tilbehor/playstation/ps5-playstation-5-spillekonsol`, marca playstation
- decisão **`model-widened`** · 4 chamadas · 4310 tokens · 141s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | PlayStation 5 Slim Standard Edition spillekonsol (2 DualSense Bundle) | 5.549 kr | -22% | 100+ | 1 | This gives you the standard PlayStation 5 console with a disc drive plus an extra controller, while saving you money compared to the Pro. |  |
| 2 | PlayStation 5 Slim Digital Edition spillekonsol (2 DualSense Bundle) | 5.299 kr | -25% | 100+ | 1 | This gives you the PlayStation 5 experience with two controllers, though you trade the disc drive for a digital-only edition. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → model.retry → tier.completed → recommend.pass1 → recommend.pass2</sub>

## `998757` — iPad Pro 13" (M5) 2TB WiFi + 5G (Space Black med Nano texture)

- **27.499 kr**, estoque esgotado, faixa 3
- categoria `mobil-tablet-smartwatch/tablet`, marca pro
- decisão **`model-same-tier`** · 3 chamadas · 6627 tokens · 98s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | iPad Pro 13" (M5) 512GB WiFi + 5G (Space Black) | 17.499 kr | -36% | 5+ | 3 | You get the exact same 13-inch M5 iPad Pro with 5G and Space Black finish, but with 512GB of storage instead and no nano texture. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → model.retry → model.retry → tier.completed → recommend.pass1</sub>

## `E11100067607` — Grohe Red II Duo C vandhane med kogende vand (warm sunset)

- **18.995 kr**, estoque esgotado, faixa —
- categoria `epoq/epoq-produkter/kokkenvask-og-vandhane/vandhane`, marca grohe
- decisão **`exact-variant`** · 1 chamadas · 325 tokens · 1s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | Grohe Red II Duo C vandhane med kogende vand (børstet krom) | 17.999 kr | -5% | 5+ | — | The same product, in stock, in a different variant. |  |
| 2 | Grohe Red II Duo C  vandhane med kogende vand (hard graphite) | 20.999 kr | +11% | <5 | — | The same product in another variant. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched</sub>

## `MFCL9570CDW` — Brother MFC-L9570CDW AIO farvelaserprinter

- **8.699 kr**, estoque esgotado, faixa 3
- categoria `computer-kontor/printere-kontor/printer`, marca brother
- decisão **`model-same-tier`** · 1 chamadas · 1034 tokens · 3s

| # | produto | preço | vs semente | estoque | faixa | por quê | Vale? |
|---|---|---|---|---|---|---|---|
| 1 | HP Color LaserJet Professional CP5225dn - printer - farve - laser | 11.399 kr | +31% | 25+ | 3 | It is another high-end professional colour laser printer from the same premium tier. |  |

<sub>etapas: seed.validated → stock.checked → variant.matched → category.pool.validated → tier.started → tier.completed → recommend.pass1</sub>

