# Prompt 1 — classificar faixa premium

Categoria: `gaming/spillekonsol-tilbehor/nintendo-switch`
77 produtos: os em estoque, mais 1118606.

O modelo NÃO recebe preço. A faixa tem que sair do nome. Isso é de propósito:
deixa conferir depois se a faixa correlaciona com preço, sem que a resposta
tenha vindo do preço.

O texto abaixo não menciona nenhum tipo de produto. A única coisa específica
é o caminho da categoria, que o modelo lê direto.

Cole tudo daqui para baixo.

---

You are a product specialist for Elgiganten, a Nordic electronics and appliance
retailer. You know how brands and product lines are positioned in the Nordic
market, across every kind of product this retailer sells.

Category: gaming/spillekonsol-tilbehor/nintendo-switch

Below are products from that category. Assign each one a premium tier from 0
to 3.

The scale:

  0  entry      — the cheapest way to get this kind of product. Budget brands,
                  retailer house brands, nothing in the name that distinguishes
                  it from the next cheapest thing.
  1  mid        — mainstream. An established brand's standard line.
  2  premium    — an established brand's upper line, or a brand that competes
                  only at the upper end of this category. Named series, flagship
                  model designations, design-led lines.
  3  luxury     — the top of a serious brand's range, or a brand whose entire
                  positioning in this category is luxury. Statement products.

Rules:

- Judge WITHIN this category. The question is never "is this expensive for a
  product", it is "where does this sit among products of this kind".
- You are NOT given prices, and you should not try to guess them. Judge market
  positioning from the brand, the product line, and what the name states.
- Size, capacity and quantity are not tier. A big basic product is still entry
  or mid; a small one from a premium line is still premium.
- Format and fitting are not tier either. How a product is installed, mounted,
  connected, packaged or worn tells you where it goes, not how good it is.
  Every format has cheap and expensive versions.
- Colour and finish are not tier on their own, but a named design-led line is a
  positioning signal.
- Use the full scale. If almost everything comes out as the same tier, you are
  not discriminating.
- When you genuinely cannot tell, answer tier 1 and confidence low. Do not
  guess high.

Output: one line per product, comma-separated, no header, no commentary.

  sku,tier,confidence

confidence is `high` or `low`. `high` only when the brand and line clearly
place the product. `low` when you are inferring from a model code alone.

Products:

992451	Asterix & Obelix: Mission Babylon (Nintendo Switch)
992443	Barbie Horse Trails (Nintendo Switch)
698717	Bionik Neoglow Nintendo Switch trådløs controller
161567	Bravely Default 2 (Nintendo Switch)
261797	Cars 3: Driven to Win - Code in Box (Nintendo Switch)
925531	Civilization VII - Nintendo Switch 2 Edition - Kode i æsken
694616	Crkd Nintendo Switch Nitro Deck (hvid)
694617	Crkd Nintendo Switch Nitro Deck (sort)
694618	Crkd Nintendo Switch Nitro Deck Retro Edition (lillla)
694619	Crkd Nintendo Switch Nitro Deck Retro Edition (mint)
181794	Deadly Premonition 2: A Blessing in Disguise (Nintendo Switch)
914167	Donkey Kong Bananza (Nintendo Switch 2)
992452	Dragon Quest VII Reimagined (Nintendo Switch 2)
992439	Dragon Quest VII Reimagined (Nintendo Switch)
628974	Everybody 1-2-Switch! (Nintendo Switch)
694638	Gioteck WX-4 Plus Nintendo Switch trådløs controller (mørk camo)
694640	Gioteck WX-4 Plus Nintendo Switch trådløs controller (terninger)
911719	Goji Nintendo Switch 2 Joy-Con opladningsstander
205796	Harvest Moon: One World (Nintendo Switch)
688624	Hyperkin Nuchamp Nintendo Switch pakke med trådløse gamepads
943145	Konix Nintendo Switch 2 bæretaske
943137	Konix Nintendo Switch 2 startpakke
625392	Little Friends: Puppy Island (Nintendo Switch)
914168	Mario Kart World (Nintendo Switch 2)
791286	Maxx Tech Duck Quack Shoot! Kit (Nintendo Switch)
SWIMINECRAFT	Minecraft - Nintendo Switch Edition (Switch)
992465	Monument Valley: The Trilogy (Nintendo Switch)
1119813	Moonlight Peaks - Nintendo Switch 2 (Switch 2)
625382	Mortal Kombat 1 (Nintendo Switch)
913953	Nintendo Switch 2 Joy-Con 2 controller (højre)
913958	Nintendo Switch 2 Joy-Con 2 controller (venstre)
913964	Nintendo Switch 2 Joy-Con 2 opladningsgreb
913961	Nintendo Switch 2 Joy-Con 2 rat (2-pakke)
913959	Nintendo Switch 2 Joy-Con 2 stroppesæt
913955	Nintendo Switch 2 Pro trådløs controller
913960	Nintendo Switch 2 spilkonsol
1118606	Nintendo Switch 2 spillekonsol (Pokémon Pokopia bundle)
913963	Nintendo Switch AC-strømadapter
247456	Nintendo Switch Joy-Con controller (rød)
SWICHARGING	Nintendo Switch Joy-Con opladerstation
SWIGRIPBLACK	Nintendo Switch komfortabelt greb - sort
284103	Nintendo Switch LAN adapter fra Piranha
531546	Nintendo Switch spillekonsol 2022 med neon Joy-Con controllers
422918	Nintendo Switch Sports (Switch)
1115378	Nintendo Switch Sports Resort (Switch 2)
182782	Paper Mario: The Origami King (Nintendo Switch)
328678	PAW Patrol The Movie: Adventure City Calls (Nintendo Switch)
SWIPROTECTCAS	Piranha beskyttende case til Nintendo Switch
47632	Piranha Comfort minigreb til Nintendo Switch Lite
368855	Piranha grebssæt til Nintendo Switch OLED
1059916	Piranha Nintendo Switch 2 adapter
1059914	Piranha Nintendo Switch 2 Joy-Con opladningsdock
990105	Piranha Nintendo Switch 2 opladningskabel
SWIPIRPOWSOL	Piranha Nintendo Switch AC strømforsyning
505447	Piranha Nintendo Switch beskyttende rejsetaske XXL
415839	Piranha Nintendo Switch foldbar opladerdock i lommestørrelse
368858	Piranha Nintendo Switch OLED skærmbeskytter
368854	Piranha Nintendo Switch opladersæt
47628	Piranha Pro-Hex minitommelgreb til Nintendo Switch Lite (4 i pakken)
353554	Piranha skærmbeskytter af hærdet glas til Nintendo Switch
353555	Piranha skærmbeskytter af hærdet glas til Nintendo Switch Lite
988111	Piranha x GhostGear Nintendo Switch 1/2 Joy-Cons oplader
386665	PowerA Enhanced Wired controller Spectra til Nintendo Switch (Sort)
386664	PowerA Enhanced Wired controller til Nintendo Switch (Blå)
12177	PowerA Nintendo Switch controller Bowser edition
688022	PowerA Nintendo Switch Enhanced USB-kablet gamepad (Mushroom Kingdom)
826173	PowerA Nintendo Switch taske til spilkonsol
698563	PowerA Nintendo Switch USB gamepad med ledning (hvid)
698559	PowerA Nintendo Switch USB-kablet gamepad (sort)
936543	PowerA Pac-Man Nintendo Switch/OLED/LIte bæretaske
907754	Trust GXT1245 Nintendo Switch skærmbeskytter
907735	Trust GXT1246 Nintendo Switch OLED-skærmbeskytter
907756	Trust GXT1247 Nintendo Switch OLED bæretaske
907750	Trust GXT1248 bæretaske til Nintendo Switch
907748	Trust GXT1248S bæretaske til Nintendo Switch
907762	Trust GXT1249 Nintendo Switch tilbehørspakke (7-pakke)
330597	WarioWare: Get It Together! (Nintendo Switch)
