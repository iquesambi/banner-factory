# Prompt 2b — faixa ±1 (só se a 2a voltar sem nada)

Gerado por `tier-report.mjs`. Categoria `mobil-tablet-smartwatch/mobiltelefon`.
Semente: Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (violet shadow) (21.999 kr, estoque "0", faixa 3).
Candidatos: 104 entre as faixas 2 e 3, em estoque. 71 a mais que a passada 1.

Ordenado por preço, do maior para o menor. Não há corte por proximidade de
preço: mais barato pelo mesmo produto é vantagem, não defeito.

A resposta é JSON, e o modelo devolve o NÚMERO do item, não o sku. O mapa
número → sku está no arquivo `-indice.json` ao lado deste.

Schema para quando isso virar chamada de API:

    z.object({
      picks: z.array(z.object({
        item: z.number().int().min(1),
        reason: z.string(),
      })),
      noneReason: z.string().nullable(),
    })

`picks` vazio é a recusa — o workflow testa `picks.length === 0` e não precisa
interpretar texto nenhum. `noneReason` só vai para log, nunca para decisão.

Cole tudo daqui para baixo.

---

You are an experienced salesperson at Elgiganten, a Nordic electronics and
appliance retailer. You know this catalogue and you know how to read what
someone wants from what they were looking at.

Category: mobil-tablet-smartwatch/mobiltelefon

A customer was looking at this product, but it is out of stock:

  Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (violet shadow)
  21999 kr

Below are products we DO have in stock, from the same category. Each carries a
premium tier from 0 (entry) to 3 (luxury), judged separately from its price.
The product the customer wanted is tier 3.

Nothing at exactly that tier was a reasonable substitute, so this list also
includes the tier above and below. A product that matches what the customer was
actually looking at can be the better recommendation even at a different tier.
Weigh tier as one signal among what the names tell you, not as a rule.

Recommend what to show this customer instead, ranked best first.

Think like someone on the shop floor. The customer chose that specific product
and not just anything in the category, and the name is where the reason lives:
the brand, the product line or series, the exact variant, and whatever else the
name spells out. A good substitute honours the reasons that are visible in the
name.

A lower price is not a compromise. If a candidate offers what the customer was
looking at and costs less, that is a better recommendation, not a worse one.
Never rank a product down for being cheaper, and never rank one up for costing
about the same as what the customer wanted.

Work only from what the names and the prices actually say. Do not assume
anything that is not written there.

Rank the candidates you would actually put in front of this customer. Include
only the ones you would genuinely offer. If a candidate would be a bad
substitute, leave it out rather than ranking it low.

For each one, give ONE short sentence saying why, naming the specific thing it
shares with the product the customer wanted, or the specific trade-off you are
offering. "Similar price" is not a reason. If the real reason is a compromise,
say so plainly: a salesperson who oversells loses the sale.

Answer with JSON and nothing else. No prose before or after, no code fence.

  {"picks": [{"item": 3, "reason": "..."}, {"item": 1, "reason": "..."}],
   "noneReason": null}

- `item` is the product's NUMBER in the list below. Never a name, never a code.
- The order of `picks` is the ranking: best first. There is no rank field.
- If NONE of them is a reasonable substitute, return `"picks": []` and put the
  explanation in `noneReason`. An empty list is how you say no.
- When you do recommend something, `noneReason` is null.

Candidates:

 1  Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (cream)  —  21999 kr  —  tier 3
 2  Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (graphite)  —  21999 kr  —  tier 3
 3  Samsung Galaxy Z Fold8 smartphone 16GB/1TB (cream)  —  20499 kr  —  tier 3
 4  Samsung Galaxy Z Fold8 smartphone 16GB/1TB (graphite)  —  20499 kr  —  tier 3
 5  Samsung Galaxy Z Fold8 smartphone 16GB/1TB (lavender)  —  20499 kr  —  tier 3
 6  iPhone 17 Pro Max 5G smartphone 2TB Kosmisk Orange  —  18399 kr  —  tier 3
 7  Samsung Galaxy Z Fold8 Ultra smartphone 12/256GB (graphite)  —  17499 kr  —  tier 3
 8  HONOR Magic V6 smartphone 16/512GB (rød)  —  16999 kr  —  tier 3
 9  HONOR Magic V6 smartphone 16/512GB (sort)  —  16999 kr  —  tier 3
10  Google Pixel 11 Pro Fold smartphone 16/512 GB (olive)  —  16799 kr  —  tier 3
11  Samsung Galaxy Z Fold 7 5G smartphone 12/256GB (Jetblack)  —  16499 kr  —  tier 3
12  Motorola Razr Fold PANTONE smartphone 16/512GB (liljehvid)  —  15999 kr  —  tier 3
13  Google Pixel 11 Pro Fold smartphone 16/256 GB (obsidian)  —  15799 kr  —  tier 3
14  HONOR Magic V5 5G smartphone 16/512GB (dawn gold)  —  14999 kr  —  tier 3
15  Samsung Galaxy S26 Ultra 5G smartphone 16/1TB (hvid)  —  14999 kr  —  tier 3
16  Samsung Galaxy S26 Ultra 5G smartphone 16GB RAM/1TB lagerplads (cobalt violet)  —  14999 kr  —  tier 3
17  iPhone 17 Pro Max 5G smartphone 1TB Sølv  —  14399 kr  —  tier 3
18  iPhone 17 Pro 5G smartphone 1TB Dybblå  —  13399 kr  —  tier 3
19  iPhone 17 Pro 5G smartphone 1TB Kosmisk Orange  —  13399 kr  —  tier 3
20  iPhone 17 Pro 5G smartphone 1TB Sølv  —  13399 kr  —  tier 3
21  OPPO Find X9 Ultra smartphone 12/512 GB (orange)  —  12999 kr  —  tier 3
22  Samsung Galaxy S26 Ultra 5G smartphone 12/512GB (hvid)  —  12999 kr  —  tier 3
23  iPhone 17 Pro Max 5G smartphone 512GB Sølv  —  12399 kr  —  tier 3
24  Google Pixel 11 Pro XL smartphone 16/512 GB (fog)  —  11999 kr  —  tier 2
25  Google Pixel 11 Pro XL smartphone 16/512 GB (obsidian)  —  11999 kr  —  tier 2
26  Google Pixel 11 Pro XL smartphone 16/512 GB (olive)  —  11999 kr  —  tier 2
27  Samsung Galaxy Z Flip8 smartphone 12/512GB (cream)  —  11999 kr  —  tier 2
28  Samsung Galaxy Z Flip8 smartphone 12/512GB (graphite)  —  11999 kr  —  tier 2
29  Samsung Galaxy Z Flip8 smartphone 12/512GB (pink)  —  11999 kr  —  tier 2
30  Samsung Galaxy S26 Ultra 5G Enterprise Edition smartphone 12/256 GB  —  11699 kr  —  tier 3
31  iPhone Air 5G smartphone 1TB Himmelblå  —  11589 kr  —  tier 3
32  iPhone Air 5G smartphone 1TB Lyst Guld  —  11589 kr  —  tier 3
33  Samsung Galaxy S26 Ultra 5G smartphone 12/256GB (sky blue)  —  11499 kr  —  tier 3
34  Samsung Galaxy S26 Ultra 5G smartphone 12/256GB (sort)  —  11499 kr  —  tier 3
35  iPhone 17 Pro 5G smartphone 512GB Sølv  —  11399 kr  —  tier 3
36  Google Pixel 11 Pro XL smartphone 12/256 GB (canyon)  —  10899 kr  —  tier 2
37  Google Pixel 11 Pro XL smartphone 12/256 GB (fog)  —  10899 kr  —  tier 2
38  Google Pixel 11 Pro XL smartphone 12/256 GB (obsidian)  —  10899 kr  —  tier 2
39  Google Pixel 11 Pro XL smartphone 12/256 GB (olive)  —  10899 kr  —  tier 2
40  Samsung Galaxy Z Flip8 smartphone 12/256GB (cream)  —  10499 kr  —  tier 2
41  Samsung Galaxy Z Flip8 smartphone 12/256GB (graphite)  —  10499 kr  —  tier 2
42  Samsung Galaxy Z Flip8 smartphone 12/256GB (pink)  —  10499 kr  —  tier 2
43  Google Pixel 11 Pro smartphone 16/512 GB (canyon)  —  10399 kr  —  tier 2
44  Google Pixel 11 Pro smartphone 16/512 GB (fog)  —  10399 kr  —  tier 2
45  Google Pixel 11 Pro smartphone 16/512 GB (obsidian)  —  10399 kr  —  tier 2
46  Google Pixel 11 Pro smartphone 16/512 GB (olive)  —  10399 kr  —  tier 2
47  iPhone 17 Pro Max 5G smartphone 256GB Kosmisk Orange  —  9999 kr  —  tier 3
48  OPPO Find X9 Pro smartphone 16/512 GB (hvid)  —  9999 kr  —  tier 2
49  OPPO Find X9 Pro smartphone 16/512 GB (sort)  —  9999 kr  —  tier 2
50  iPhone Air 5G smartphone 512GB Himmelblå  —  9589 kr  —  tier 3
51  iPhone Air 5G smartphone 512GB Lyst Guld  —  9499 kr  —  tier 3
52  Samsung Galaxy S26 5G smartphone 12/512GB (cobalt violet)  —  9499 kr  —  tier 2
53  Samsung Galaxy S26 5G smartphone 12/512GB (hvid)  —  9499 kr  —  tier 2
54  Samsung Galaxy S26 5G smartphone 12/512GB (sky blue)  —  9499 kr  —  tier 2
55  Samsung Galaxy S26 5G smartphone 12/512GB (sort)  —  9499 kr  —  tier 2
56  Google Pixel 11 Pro smartphone 12/256 GB (canyon)  —  9399 kr  —  tier 2
57  Google Pixel 11 Pro smartphone 12/256 GB (fog)  —  9399 kr  —  tier 2
58  Google Pixel 11 Pro smartphone 12/256 GB (obsidian)  —  9399 kr  —  tier 2
59  Google Pixel 11 Pro smartphone 12/256 GB (olive)  —  9399 kr  —  tier 2
60  iPhone 17 Pro 5G smartphone 256GB Dybblå  —  9399 kr  —  tier 3
