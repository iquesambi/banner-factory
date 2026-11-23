# Prompt 1 — classificar faixa premium

Categoria: `mobil-tablet-smartwatch/mobiltelefon`
251 produtos: os em estoque, mais 1116833.

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

Category: mobil-tablet-smartwatch/mobiltelefon

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

F8J168BT	Belkin bilholder til smartphone
823893	Cable Guys Deadpool 3 smartphone/controller holderfigur (R.E.S.T)
823887	Cable Guys Gojira smartphone/controller holderfigur
783601	Cable Guys IKON smartphone/controller holderfigur (Star Wars)
783609	Cable Guys IKON smartphone/controller-holderfigur (Hogwarts)
783612	Cable Guys IKON smartphone/controller-holderfigur (PlayStation)
783598	Cable Guys IKON smartphone/controller-holderfigur (Sonic)
257408	Cable Guys Marvel holderfigur til smartphone/controller (toddler Groot)
257401	Cable Guys Marvel smartphone/controller holderfigur (Gamerverse)
892472	Cable Guys Minecraft mini smartphone/controller holderfigur (Piglin)
892468	Cable Guys Minecraft mini smartphone/controller holderfigur (Steve)
823888	Cable Guys Minecraft smartphone/controller holderfigur (Creeper)
892473	Cable Guys Minecraft smartphone/controller holderfigur (Enderman)
823890	Cable Guys Minecraft smartphone/controller holderfigur (Steve)
783607	Cable Guys smartphone/controller holderfigur (Loki)
783597	Cable Guys smartphone/controller holderfigur (Thanos)
783604	Cable Guys smartphone/controller-holderfigur (Anti-Venom)
783594	Cable Guys smartphone/controller-holderfigur (Fall Guys)
783615	Cable Guys smartphone/controller-holderfigur (Rainbow Stitch)
783591	Cable Guys smartphone/controller-holderfigur (Stitch as Elvis)
783589	Cable Guys smartphone/controller-holderfigur (Toasted Monkey Bomb)
823882	Cable Guys TNMT smartphone/controller holderfigur (Shredder)
823892	Cable Guys Transformers smartphone/controller holderfigur (Optimus Prime)
465491	Cable Guys WB smartphone/controller holderfigur (Beetlejuice)
819077	Dbramante1928 Eco-Shield iPhone 16 Pro Max skærmbeskytter (sort)
819089	dbramante1928 eco-shield iPhone 16/15 skærmbeskytter med sort kant
640715	dbramante1928 iPhone 17e/16e/14/13/13 Pro skærmbeskytter med sort kant
921074	Doro Aurora A11 smartphone 4/64GB (Bone)
921073	Doro Aurora A11 smartphone 4/64GB (Grafit)
921072	Doro Aurora A21 smartphone 4/64GB (Bone)
921077	Doro Aurora A21 smartphone 4/64GB (Grafit)
921075	Doro Aurora A31 smartphone 6/128GB (Bone)
858315	Doro Leva L11 mobiltelefon (grafit)
858311	Doro Leva L11 mobiltelefon (rød)
903708	Doro Leva X10 mobiltelefon (hvid/sort)
935422	Fairphone (Gen. 6) 5G smartphone 8/256GB (grøn)
935423	Fairphone (Gen. 6) 5G smartphone 8/256GB (sort)
681060	Fairphone 5 batteri til mobiltelefon
681070	Fairphone 5 Blue light mobiltelefon skærmbeskytter
1115512	Fairphone Gen. 6+ smartphone 12/256 GB (blå)
1115511	Fairphone Gen. 6+ smartphone 12/256 GB (grøn)
1115510	Fairphone Gen. 6+ smartphone 12/256 GB (sort)
805730	Fujifilm Instax Mini Link 3 smartphone-printer (hvid)
1027603	Google Pixel 10a 5G smartphone 8/128 GB (obsidian)
1027609	Google Pixel 10a 5G smartphone 8/256 GB (bær)
1027601	Google Pixel 10a 5G smartphone 8/256 GB (lavendel)
1122424	Google Pixel 11 Pro Fold smartphone 16/256 GB (obsidian)
1122432	Google Pixel 11 Pro Fold smartphone 16/512 GB (olive)
1122439	Google Pixel 11 Pro smartphone 12/256 GB (canyon)
1122420	Google Pixel 11 Pro smartphone 12/256 GB (fog)
1122417	Google Pixel 11 Pro smartphone 12/256 GB (obsidian)
1122425	Google Pixel 11 Pro smartphone 12/256 GB (olive)
1122447	Google Pixel 11 Pro smartphone 16/512 GB (canyon)
1122442	Google Pixel 11 Pro smartphone 16/512 GB (fog)
1122431	Google Pixel 11 Pro smartphone 16/512 GB (obsidian)
1122430	Google Pixel 11 Pro smartphone 16/512 GB (olive)
1122426	Google Pixel 11 Pro XL smartphone 12/256 GB (canyon)
1122421	Google Pixel 11 Pro XL smartphone 12/256 GB (fog)
1122446	Google Pixel 11 Pro XL smartphone 12/256 GB (obsidian)
1122438	Google Pixel 11 Pro XL smartphone 12/256 GB (olive)
1122436	Google Pixel 11 Pro XL smartphone 16/512 GB (fog)
1122448	Google Pixel 11 Pro XL smartphone 16/512 GB (obsidian)
1122435	Google Pixel 11 Pro XL smartphone 16/512 GB (olive)
1122445	Google Pixel 11 smartphone 12/256 GB (frost)
1122419	Google Pixel 11 smartphone 12/256 GB (obsidian)
1122437	Google Pixel 11 smartphone 12/256 GB (pistachio)
1122423	Google Pixel 11 smartphone 12/512 GB (frost)
1122429	Google Pixel 11 smartphone 12/512 GB (obsidian)
1122422	Google Pixel 11 smartphone 12/512 GB (pistachio)
903693	HMD 2660 mobiltelefon (sort)
853650	HMD Fusion smartphone 6/128GB (sort)
1059822	HMD TERRA M mobiltelefon (sort)
1084230	HONOR 600 Lite smartphone 8/128GB (velvet black)
1084231	HONOR 600 Pro smartphone 12/512GB (gylden hvid)
1084227	HONOR 600 Pro smartphone 12/512GB (sort)
1116799	HONOR 600 Smart 5G smartphone 4/128GB (sort)
1084223	HONOR 600 smartphone 8/256GB (sort)
1016900	Honor Magic 8 Pro smartphone 12/512GB (sort)
968047	HONOR Magic V5 5G smartphone 16/512GB (dawn gold)
1116802	HONOR Magic V6 smartphone 16/512GB (rød)
1116798	HONOR Magic V6 smartphone 16/512GB (sort)
991709	HONOR X5c Plus smartphone 4/64GB (ocean cyan)
302174	HP Sprocket Luna smartphone-printer (hvid)
947356	iDeal of Sweden Magnet Wallet+ til iPhone 17 Pro (sort)
947358	iDeal of Sweden Magnet Wallet+ til iPhone 17 Pro Max (pink)
947369	iDeal of Sweden Magnet Wallet+ til iPhone 17 Pro Max (sort)
673011	iPhone 15 – 5G smartphone 128GB Blå
672992	iPhone 15 – 5G smartphone 256GB Sort
673005	iPhone 15 128GB Black
825085	iPhone 16 – 5G smartphone 128GB (blågrøn)
825096	iPhone 16 – 5G smartphone 128GB (hvid)
825138	iPhone 16 – 5G smartphone 128GB (lyserød)
825094	iPhone 16 – 5G smartphone 128GB (sort)
825083	iPhone 16 – 5G smartphone 128GB (ultramarine)
825116	iPhone 16 Plus – 5G smartphone 128GB (hvid)
825111	iPhone 16 Plus – 5G smartphone 128GB (lyserød)
825101	iPhone 16 Plus – 5G smartphone 128GB (sort)
825105	iPhone 16 Plus – 5G smartphone 256GB (sort)
900973	iPhone 16e smartphone 128GB (Hvid)
900970	iPhone 16e smartphone 128GB (Sort)
982740	iPhone 17 Pro 5G smartphone 1TB Dybblå
982745	iPhone 17 Pro 5G smartphone 1TB Kosmisk Orange
982755	iPhone 17 Pro 5G smartphone 1TB Sølv
982753	iPhone 17 Pro 5G smartphone 256GB Dybblå
982719	iPhone 17 Pro 5G smartphone 512GB Sølv
982709	iPhone 17 Pro Max 5G smartphone 1TB Sølv
982716	iPhone 17 Pro Max 5G smartphone 256GB Kosmisk Orange
982728	iPhone 17 Pro Max 5G smartphone 2TB Kosmisk Orange
982723	iPhone 17 Pro Max 5G smartphone 512GB Sølv
982752	iPhone Air 5G smartphone 1TB Himmelblå
982747	iPhone Air 5G smartphone 1TB Lyst Guld
982759	iPhone Air 5G smartphone 512GB Himmelblå
982762	iPhone Air 5G smartphone 512GB Lyst Guld
1035937	Motorola Edge 70 Fusion smartphone 8/256GB
1035938	Motorola Edge 70 Fusion smartphone 8/256GB
1118124	Motorola Edge 70 Max 5G smartphone 8/256 GB (grå)
1118122	Motorola Edge 70 Max 5G smartphone 8/256 GB (sort)
975757	Motorola G06 LTE smartphone 64GB (arabesque)
975756	Motorola G06 LTE smartphone 64GB (tapestry)
975760	Motorola G06 LTE smartphone 64GB (tendril)
975758	Motorola G06 Power LTE smartphone 256GB (laurbær eg)
975759	Motorola G06 Power LTE smartphone 256GB (tapestry)
1078101	Motorola G37 smartphone 4/128 (impenetrable)
1026113	Motorola G67 smartphone 4/128 (grøn)
1026111	Motorola G67 smartphone 4/128 (lilla)
1026115	Motorola G77 smartphone 8/128 (blå)
1026110	Motorola G77 smartphone 8/128 (sort)
1078106	Motorola Razr Fold PANTONE smartphone 16/512GB (liljehvid)
903692	Nokia 105 mobiltelefon (sort)
898729	Nokia 225 4G mobiltelefon (mørkeblå)
898727	Nokia 225 4G mobiltelefon (pink)
898731	Nokia 3210 4G mobiltelefon (blå)
898730	Nokia 3210 4G mobiltelefon (guld)
898728	Nokia 3210 4G mobiltelefon (sort)
1116485	nubia Air 5G smartphone 8/256GB (brun)
1116484	nubia Air 5G smartphone 8/256GB (sort)
916417	Nystart iPhone 11 64 GB (grøn)
916428	Nystart iPhone 11 64 GB (lilla)
660006	Nystart iPhone 11 Pro Max smartphone 64 GB (space grey)
660007	Nystart iPhone 11 Pro smartphone 64 GB (space grey)
916425	Nystart iPhone 11 smartphone 128 GB (hvid)
916433	Nystart iPhone 12 - 5G smartphone 12 - 128 GB (hvid)
916434	Nystart iPhone 12 - 5G smartphone 64 GB (grøn)
916420	Nystart iPhone 12 - 5G smartphone 64 GB (purple)
660004	Nystart iPhone 12 Pro - 5G smartphone 128GB (grafit)
660003	Nystart iPhone 12 Pro Max - 5G smartphone 128GB (grafit)
916435	Nystart iPhone 13 – 5G smartphone 128GB Grøn
660002	Nystart iPhone 13 – 5G smartphone 128GB Midnight
916421	Nystart iPhone 13 – 5G smartphone 128GB Pink
942362	Nystart iPhone 14 – 5G smartphone 128GB lilla
942364	Nystart iPhone 14 – 5G smartphone 128GB Product Red
916419	Nystart iPhone SE Gen. 3 smartphone 64GB (midnight)
660001	Nystart iPhone SE smartphone 64 GB (sort)
660000	Nystart iPhone XR smartphone 64 GB (sort)
916427	Nystart iPhone XR smartphone 64GB (hvid)
1125079	OPPO Find X9 Pro smartphone 16/512 GB (hvid)
1125080	OPPO Find X9 Pro smartphone 16/512 GB (sort)
1125082	OPPO Find X9 Ultra smartphone 12/512 GB (orange)
1125077	OPPO Reno16 F 5G smartphone 8/256 GB (hvid)
1116589	realme 16 Pro+ 5G smartphone 12/512GB (Mester Grå)
1116585	realme 16 Pro+ 5G smartphone 8/256GB (Master Gold)
1116577	realme 16 Pro+ 5G smartphone 8/256GB (Master Grå)
1116588	realme C100x smartphone 4/256GB (Deepblue Tides)
1116578	realme C100x smartphone 4/256GB (Gyldne Kyst)
1116579	realme GT 8 Pro smartphone 12/256GB (Urban Blå)
1116591	realme GT 8 Pro smartphone 16/512GB (Urban Blå)
950278	Samsung Galaxy A17 5G smartphone 128GB (Blå)
950275	Samsung Galaxy A17 5G smartphone 128GB (Sort)
950272	Samsung Galaxy A17 5G smartphone 256GB (Sort)
950274	Samsung Galaxy A17 LTE smartphone 256GB (Grå)
950279	Samsung Galaxy A17 LTE smartphone 256GB (Lyseblå)
950273	Samsung Galaxy A17 LTE smartphone 256GB (Sort)
1114592	Samsung Galaxy A27 5G smartphone 6/128GB (blå)
1114588	Samsung Galaxy A27 5G smartphone 6/128GB (lys lyserød)
1114591	Samsung Galaxy A27 5G smartphone 6/128GB (sort)
1114589	Samsung Galaxy A27 5G smartphone 8/256GB (sort)
1059795	Samsung Galaxy A37 5G smartphone 6/128GB (Charcoal)
1059813	Samsung Galaxy A37 5G smartphone 6/128GB (Hvid)
1059801	Samsung Galaxy A37 5G smartphone 6/128GB (Lavendel)
1059811	Samsung Galaxy A37 5G smartphone 8/256GB (Charcoal)
1059807	Samsung Galaxy A37 5G smartphone 8/256GB (Grågrøn)
1059802	Samsung Galaxy A37 5G smartphone 8/256GB (Hvid)
1059789	Samsung Galaxy A37 5G smartphone 8/256GB (Lavendel)
1059754	Samsung Galaxy A57 5G smartphone 8/128GB (Grå)
1059766	Samsung Galaxy A57 5G smartphone 8/128GB (Isblå)
1059805	Samsung Galaxy A57 5G smartphone 8/128GB (Marineblå)
1059771	Samsung Galaxy A57 5G smartphone 8/256GB (Lilla)
1059778	Samsung Galaxy A57 5G smartphone 8/256GB (Marineblå)
938008	Samsung Galaxy S25 5G smartphone 12/128GB (blåsort)
877359	Samsung Galaxy S25 5G smartphone 12/128GB (Navy)
877337	Samsung Galaxy S25 5G smartphone 12/128GB (Silver Shadow)
895322	Samsung Galaxy S25 5G smartphone 12/128GB Enterprise (Silver Shadow)
877355	Samsung Galaxy S25 5G smartphone 12/256GB (Navy)
911723	Samsung Galaxy S25 Edge 5G smartphone 12/512GB (Titanium Jetblack)
911724	Samsung Galaxy S25 Edge 5G smartphone 12/512GB (Titanium Sølv)
968438	Samsung Galaxy S25 FE 5G smartphone 8/128GB (hvid)
1039742	Samsung Galaxy S26 5G Enterprise Edition smartphone 12/256GB
1039731	Samsung Galaxy S26 5G smartphone 12/256GB (cobalt violet)
1039740	Samsung Galaxy S26 5G smartphone 12/512GB (cobalt violet)
1039750	Samsung Galaxy S26 5G smartphone 12/512GB (hvid)
1039727	Samsung Galaxy S26 5G smartphone 12/512GB (sky blue)
1039747	Samsung Galaxy S26 5G smartphone 12/512GB (sort)
1039752	Samsung Galaxy S26 Plus 5G smartphone 12/512GB (sky blue)
1039734	Samsung Galaxy S26 Plus 5G smartphone 12/512GB (sort)
1039741	Samsung Galaxy S26 Ultra 5G Enterprise Edition smartphone 12/256 GB
1039735	Samsung Galaxy S26 Ultra 5G smartphone 12/256GB (sky blue)
1039737	Samsung Galaxy S26 Ultra 5G smartphone 12/256GB (sort)
1039725	Samsung Galaxy S26 Ultra 5G smartphone 12/512GB (hvid)
1039726	Samsung Galaxy S26 Ultra 5G smartphone 16/1TB (hvid)
1039724	Samsung Galaxy S26 Ultra 5G smartphone 16GB RAM/1TB lagerplads (cobalt violet)
1116829	Samsung Galaxy Z Flip8 smartphone 12/256GB (cream)
1116832	Samsung Galaxy Z Flip8 smartphone 12/256GB (graphite)
1116827	Samsung Galaxy Z Flip8 smartphone 12/256GB (pink)
1116818	Samsung Galaxy Z Flip8 smartphone 12/512GB (cream)
1116831	Samsung Galaxy Z Flip8 smartphone 12/512GB (graphite)
1116816	Samsung Galaxy Z Flip8 smartphone 12/512GB (pink)
943116	Samsung Galaxy Z Fold 7 5G smartphone 12/256GB (Jetblack)
1116814	Samsung Galaxy Z Fold8 smartphone 16GB/1TB (cream)
1116824	Samsung Galaxy Z Fold8 smartphone 16GB/1TB (graphite)
1116826	Samsung Galaxy Z Fold8 smartphone 16GB/1TB (lavender)
1116821	Samsung Galaxy Z Fold8 Ultra smartphone 12/256GB (graphite)
1116813	Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (cream)
1116823	Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (graphite)
1116833	Samsung Galaxy Z Fold8 Ultra smartphone 16GB/1TB (violet shadow)
328960	Sandstrøm buet skærmbeskytter i glas til iPhone 13/13 Pro/14/16e/17e
943353	Sandstrøm Clear skærmbeskytter til iPhone 17 Air
S3DI7BG18	Sandstrøm Curved Glass iPhone 6/7/8/SE Gen. 2/3 (sort)
638321	Sandstrøm iPhone 14 Pro Max/15 Plus /15 Pro Max/16 Plus skærmbeskytter
638316	Sandstrøm iPhone 15 Plus/14 Pro Max Curved Glass skærmbeskytter
638320	Sandstrøm iPhone 15/14 Pro Curved Glass skærmbeskytter
638317	Sandstrøm iPhone 15/15 Pro/14 Pro Flat Glass skærmbeskytter
797021	Sandstrøm iPhone 16 Pro Curved Glass skærmbeskytter
797023	Sandstrøm iPhone 16 Pro Max Curved Glass skærmbeskytter
S3UGI717	Sandstrøm iPhone 6/7/8/SE Gen. 2/3 Ultimate Xtreme skærmbeskytter
943351	Sandstrøm Sapphire skærmbeskytter til iPhone 16 Pro Max/17 Pro Max
943352	Sandstrøm Sapphire skærmbeskytter til iPhone 16 Pro/17/17 Pro
943354	Sandstrøm Sapphire skærmbeskytter til iPhone 17 Air
936422	Sandstrøm smartphone bilholder
927234	Snapcase læderpung 9 kort iPhone 16E/17E/15/14/13 (Sort)
994334	Snapcase MagWallet iPhone 13/14/15/16E/17E (Sort)
967357	TCL Onetouch 5041 4G mobiltelefon
967355	TCL Onetouch 5044 4G mobiltelefon (himalaya grå)
201462	Trigger Happy clip-on tommelstick til mobiltelefon
201463	Trigger Happy nøglering joystick til mobiltelefon
201467	Trigger Happy trigger-sæt til mobiltelefon
943329	ZAGG Elite privacy glas til iPhone 17
943330	ZAGG Elite Privacy glas til iPhone 17 Air
943332	ZAGG Elite Privacy glas til iPhone 17 Pro
943333	ZAGG Elite Privacy glas til iPhone 17 Pro Max
524568	ZAGG InvisibleShield iPhone 14 Pro Skærmbeskytter Glass XTR2
1116483	ZTE nubia A57 smartphone 4/64GB (sort)
