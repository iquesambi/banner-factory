# Product feed snapshot

`2026-08-25-elkjop-ai-personalisation-pilot-ddb-dk.json.gz`

A frozen snapshot of the Elgiganten Denmark product feed, taken on 2026-08-25.

| | |
|---|---|
| Format | gzipped JSON, a flat array of product objects |
| Products | 28,231 |
| Market | Denmark; all text is Danish |
| Currency | DKK (not declared in the feed) |
| Size | 14 MB gzipped, about 78 MB uncompressed |
| SHA-256 | `c6a022702dba6284c1b279f93514f564dc9a673065448ed2ac955a33e1133853` |

```bash
gunzip -k 2026-08-25-elkjop-ai-personalisation-pilot-ddb-dk.json.gz
```

## Fields

Every record has the same 18 fields, all strings. An empty value is `""`.

| Field | Content |
|---|---|
| `product-name` | Product name |
| `SKU` | Unique product id |
| `Price` | Current price, the one the customer pays today. Any discount is already applied |
| `SalePrice` | Filled on some discounted products, and then equal to `Price` |
| `SavePriceAmount` | Amount saved against the previous price, when present. The previous price is not in the feed: it is `Price` + `SavePriceAmount` |
| `Image` | Main product image URL |
| `AdditionalImageUrls` | More image URLs, comma-separated in one string |
| `DescriptionShort` | Short description |
| `DescriptionLong` | Long description |
| `Bulletpoint1`, `Bulletpoint2`, `Bulletpoint3` | Selling points |
| `SalesPoint` | Promotional label |
| `StockLevelEcomFormat` | Stock band: `0`, `<5`, `5+`, `25+`, `50+`, `100+` |
| `EnergyLabelUrl`, `EnergyEfficiencyClass`, `EnergyArrowUrlPng`, `EnergyArrowUrlSvg` | EU energy label |

The feed has no category, brand, product URL or language field. This is real
data: explore it before trusting it.
