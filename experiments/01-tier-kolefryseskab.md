# Prompt 1 — classificar faixa premium

Categoria: `hvidevarer/koleskabe-fryseskabe/kolefryseskab`
98 produtos: os em estoque, mais 802582.

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

Category: hvidevarer/koleskabe-fryseskabe/kolefryseskab

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

1048987	AEG Serie 6000 Kølefryseskab OSC6L181ES (integreret)
807977	Bosch Serie 2 Kølefryseskab KBN96NSE0 (integreret)
673714	Bosch Serie 2 Kølefryseskab KIN96NSE0 (integreret)
673696	Bosch Serie 2 Kølefryseskab KIV865SE0 (integreret)
498120	Bosch Serie 4 French Door Kølefryseskab KFN96APEA (inox)
498116	Bosch Serie 4 French Door Kølefryseskab KFN96AXEA (sort)
807976	Bosch Serie 4 Kølefryseskab KBN96VSE0 (integreret)
454452	Bosch Serie 4 Kølefryseskab KGN392WDF (hvid)
917853	Bosch Serie 4 Kølefryseskab KGN39OCAF (gråsort)
917854	Bosch Serie 4 Kølefryseskab KGN49OCAF (rustfrit antracit)
522088	Bosch Serie 4 Kølefryseskab KGN49VXCT (sort inox)
454456	Bosch Serie 4 Kølefryseskab KGN49XLEA (inox)
368760	Bosch Serie 4 Kølefryseskab KIN86VSE0 (integreret)
673709	Bosch Serie 4 Kølefryseskab KIN96SFD0 (integreret)
673690	Bosch Serie 6 Kølefryseskab KBN96SDD0 (integreret)
179564	Bosch Serie 6 Kølefryseskab KGE39AWCA (hvid)
776828	DeLonghi Kølefryseskab DNF186W24E (hvid)
968269	Electrolux Serie 500 Kølefryseskab LNT3LE3W1R (hvid)
1048988	Electrolux Serie 600 Kølefryseskab LNA6LE18S (integreret)
608141	Electrolux Serie 600 Kølefryseskab LNT5ME32W1 (hvid)
608140	Electrolux Serie 600 Kølefryseskab LNT5ME36W1 (hvid)
1048991	Electrolux Serie 700 Kølefryseskab ENA7CD18S (integreret)
1048996	Electrolux Serie 800 Kølefryseskab ENG8MD19S (integreret)
1048990	Electrolux Serie 800 Kølefryseskab ENG8TD75S (integreret)
941774	Electrolux Serie 800 Kølefryseskab ENT8MD32K (sort)
941773	Electrolux Serie 800 Kølefryseskab ENT8MD36K (sort)
783888	Electrolux Serie 800 Kølefryseskab ENT8MD36W (hvid)
1048994	Electrolux Serie 900 Kølefryseskab ENZ9GB18S (integreret)
802582	Fisher & Paykel French door kølefryseskab RS90A3 (rustfrit)
1120200	Haier kølefryseskab HTW5620CNMP (sort)
1120203	Haier kølefryseskab HTW7720ENPT (sort)
762689	Hisense French Door Kølefryseskab RF540N4SBI2 (rustfrit stål)
1083083	Hisense Kølefryseskab RB390N4AWE (hvid)
1083081	Hisense Kølefryseskab RB435N4BWE (hvid)
731506	Indesit Kølefryseskab LI8 S2E W (hvid)
1046765	LG Kølefryseskab GBBS716AEV (sort rustfrit stål)
1046766	LG Kølefryseskab GBBS716ASW (hvid)
1072812	LG Kølefryseskab GBBS716CEV (sort rustfrit stål)
1049471	LG Kølefryseskab GBBS716CSW (hvid)
1046764	LG Kølefryseskab GBBS726ASW (hvid)
1049470	LG Kølefryseskab GBBS726CEV (sort stål)
1049469	LG Kølefryseskab GBBS726CSW (hvid)
1046726	LG Kølefryseskab GBBSJ10DEP (sort rustfrit stål)
1046724	LG Kølefryseskab GBBSJ10DSW (hvid)
1005285	LG Kølefryseskab GBBSJ10ESW (hvid)
1046728	LG Kølefryseskab GBBSJ20DEP (sort rustfrit stål)
1046725	LG Kølefryseskab GBBSJ20DSW (hvid)
1005283	LG Kølefryseskab GBBSJ20ESW (hvid)
1083003	LG Kølefryseskab GBBW726AEV (sort rustfri stål)
603779	LG Kølefryseskab GBP62MCNAC (sort)
927401	LG Kølefryseskab GBV21NCDEP (sort rustfrit stål)
917778	LG Kølefryseskab GBV21NCDSW (Hvid)
603777	LG Kølefryseskab GBV5140DSW (hvid)
591898	Logik Kølefryseskab L113CW23E (hvid)
591899	Logik Kølefryseskab L151CW23E (hvid)
633646	Logik Kølefryseskab LDD115W23E (hvid)
633640	Logik Kølefryseskab LDD143W23E (hvid)
633637	Logik Kølefryseskab LDD85X23E (inox)
591904	Logik Kølefryseskab LNF180T23E (sort)
591902	Logik Kølefryseskab LNF180W23E (hvid)
591905	Logik Kølefryseskab LNF186W23E (hvid)
591900	Logik Kølefryseskab LS186W23E (hvid)
805013	Miele Kølefryseskab KFN 4799 AD 125 Gala Ed (sort)
987682	Miele Kølefryseskab KFN 7734 B (integreret)
879304	Miele Kølefryseskab KFN 7833 D (integreret)
1106771	Miele Kølefryseskab KFN 7934 D (integreret)
770744	Samsung French Door Kølefryseskab RF65DG9H0ESREF (rustfrit stål)
770739	Samsung Kølefryseskab BRB38G705DWWEF (integreret)
944882	Samsung Kølefryseskab BRB70F26DES0EF (integreret)
944881	Samsung Kølefryseskab BRB80F30ADS0EF (integreret)
613878	Samsung Kølefryseskab RB34C705CB1/EF (sort rustfrit stål)
613863	Samsung Kølefryseskab RB34C705CWW/EF (hvid)
613871	Samsung Kølefryseskab RB34C705DWW/EF (hvid)
614567	Samsung Kølefryseskab RB38C705CB1/EF (sort rustfrit stål)
614566	Samsung Kølefryseskab RB38C705CWW/EF (hvid)
613868	Samsung Kølefryseskab RB38C705DWW/EF (hvid)
673683	Siemens iQ100 Kølefryseskab KI86NNSE0 (integreret)
1089424	Siemens iQ300 Kølefryseskab KG36NVWCG (hvid)
1089412	Siemens iQ300 Kølefryseskab KG36NVWDG (hvid)
1089435	Siemens iQ300 Kølefryseskab KG49NVIDG (rustfrit stål)
1089425	Siemens iQ300 Kølefryseskab KG49NVWDG (hvid)
368758	Siemens iQ300 Kølefryseskab KI86NVSE0 (integreret)
526754	Siemens iQ500 Kølefryseskab KG39E8XBA (sort rustfrit stål)
948335	Smeg 50's Style Kølefryseskab FAB28LPG6 (grøn)
948332	Smeg 50's Style Kølefryseskab FAB30LPK6 (pink)
948356	Smeg 50's Style Kølefryseskab FAB32RPB6 (pastelblå)
921069	Smeg 50's Style Kølefryseskab FAB38LBL6 (sort)
292460	Smeg 50's Style Kølefryseskab FAB50RCR5 (cream)
914151	Smeg Serie Classic Kølefryseskab FA3905LX6 (rustfrit stål)
318475	Smeg Serie Colonial Kølefryseskab FA8005LAO5 (antracit)
1000716	Smeg Serie Universal Kølefryseskab FC48KDND (inox)
912279	TCL Kølefryseskab RF340BWD0NE (hvid)
912278	TCL Kølefryseskab RF382BWD0NE (hvid)
944488	TCL Kølefryseskab RP409BWE0NE (hvid)
1054256	TCL Kølefryseskab RP532BIE2
1054259	TCL Kølefryseskab RP532BWE2
1054260	TCL Kølefryseskab RP593BIE2
1054258	TCL Kølefryseskab RP593BWE2
