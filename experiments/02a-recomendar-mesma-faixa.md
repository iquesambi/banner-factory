# Prompt 2a — mesma faixa

Gerado por `tier-report.mjs`. Categoria `mobil-tablet-smartwatch/mobiltelefon`.
Semente: Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (violet shadow) (21.999 kr, estoque "0", faixa 3).
Candidatos: 33 da mesma faixa (3), em estoque.

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

Below are products we DO have in stock, from the same category. All of them sit
at the same premium tier as the product the customer wanted, judged separately
from price. Recommend what to show this customer instead, ranked best first.

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

 1  Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (cream)  —  21999 kr
 2  Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (graphite)  —  21999 kr
 3  Samsung Galaxy Z Fold8 smartphone 16GB/1TB (cream)  —  20499 kr
 4  Samsung Galaxy Z Fold8 smartphone 16GB/1TB (graphite)  —  20499 kr
 5  Samsung Galaxy Z Fold8 smartphone 16GB/1TB (lavender)  —  20499 kr
 6  iPhone 17 Pro Max 5G smartphone 2TB Kosmisk Orange  —  18399 kr
 7  Samsung Galaxy Z Fold8 Ultra smartphone 12/256GB (graphite)  —  17499 kr
 8  HONOR Magic V6 smartphone 16/512GB (rød)  —  16999 kr
 9  HONOR Magic V6 smartphone 16/512GB (sort)  —  16999 kr
10  Google Pixel 11 Pro Fold smartphone 16/512 GB (olive)  —  16799 kr
11  Samsung Galaxy Z Fold 7 5G smartphone 12/256GB (Jetblack)  —  16499 kr
12  Motorola Razr Fold PANTONE smartphone 16/512GB (liljehvid)  —  15999 kr
13  Google Pixel 11 Pro Fold smartphone 16/256 GB (obsidian)  —  15799 kr
14  HONOR Magic V5 5G smartphone 16/512GB (dawn gold)  —  14999 kr
15  Samsung Galaxy S26 Ultra 5G smartphone 16/1TB (hvid)  —  14999 kr
16  Samsung Galaxy S26 Ultra 5G smartphone 16GB RAM/1TB lagerplads (cobalt violet)  —  14999 kr
17  iPhone 17 Pro Max 5G smartphone 1TB Sølv  —  14399 kr
18  iPhone 17 Pro 5G smartphone 1TB Dybblå  —  13399 kr
19  iPhone 17 Pro 5G smartphone 1TB Kosmisk Orange  —  13399 kr
20  iPhone 17 Pro 5G smartphone 1TB Sølv  —  13399 kr
21  OPPO Find X9 Ultra smartphone 12/512 GB (orange)  —  12999 kr
22  Samsung Galaxy S26 Ultra 5G smartphone 12/512GB (hvid)  —  12999 kr
23  iPhone 17 Pro Max 5G smartphone 512GB Sølv  —  12399 kr
24  Samsung Galaxy S26 Ultra 5G Enterprise Edition smartphone 12/256 GB  —  11699 kr
25  iPhone Air 5G smartphone 1TB Himmelblå  —  11589 kr
26  iPhone Air 5G smartphone 1TB Lyst Guld  —  11589 kr
27  Samsung Galaxy S26 Ultra 5G smartphone 12/256GB (sky blue)  —  11499 kr
28  Samsung Galaxy S26 Ultra 5G smartphone 12/256GB (sort)  —  11499 kr
29  iPhone 17 Pro 5G smartphone 512GB Sølv  —  11399 kr
30  iPhone 17 Pro Max 5G smartphone 256GB Kosmisk Orange  —  9999 kr
31  iPhone Air 5G smartphone 512GB Himmelblå  —  9589 kr
32  iPhone Air 5G smartphone 512GB Lyst Guld  —  9499 kr
33  iPhone 17 Pro 5G smartphone 256GB Dybblå  —  9399 kr
