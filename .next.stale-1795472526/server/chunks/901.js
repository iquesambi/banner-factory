"use strict";exports.id=901,exports.ids=[901],exports.modules={4701:(a,b,c)=>{c.d(b,{CX:()=>i,d0:()=>g});var d=c(73024),e=c(38522),f=c(77598);function g(a="data/2026-08-25-elkjop-ai-personalisation-pilot-ddb-dk.json.gz"){let b=(0,d.readFileSync)(a);return{version:(0,f.createHash)("sha256").update(b).digest("hex").slice(0,12),products:JSON.parse((0,e.gunzipSync)(b).toString("utf8"))}}function h(a){let b=Number.parseFloat((a??"").trim());return Number.isFinite(b)?b:null}function i(a){let b=h(a.Price)??0,c=h(a.SavePriceAmount);return{price:b,saveAmount:c,oldPrice:null!==c?b+c:null,discountPct:null!==c&&c>0?Number((c/(b+c)*100).toFixed(1)):0,stockBand:(a.StockLevelEcomFormat??"").trim(),image:a.Image?.trim()||null,energyClass:a.EnergyEfficiencyClass?.trim()||null,salesPoint:a.SalesPoint?.trim()||null}}},6680:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{XY:()=>n,d5:()=>o,le:()=>k,sE:()=>j,u0:()=>l,vH:()=>p});var e=c(3410),f=c(25777),g=c(18626),h=c(17492),i=a([e,f]);[e,f]=i.then?(await i)():i;let k=process.env.STRATEGIST_MODEL??process.env.TAGGER_MODEL??"gemini-3.5-flash-lite",l=process.env.STRATEGIST_FALLBACK_MODEL??"",m=`You are the strategy director for an Elgiganten hero banner. The product is
chosen, the copy is written, and the facts that may be shown have already been
checked for truth. Your job is to decide which of those facts earn a place on
the banner, and in what order.

Everything on the list is true and permitted. The question is never "is this
allowed" — it is "does this make the banner work harder".

WHAT MAKES A BADGE EARN ITS PLACE

It adds something the copy does not already say. The headline and the
supporting line are in front of you. If the copy already carries the saving,
the badge repeating it buys nothing and costs the one slot that could have
carried a second idea.

It matters for THIS product. Energy running costs weigh on a fridge or a
washing machine over ten years, and weigh very little on a pair of headphones.
A multi-buy mechanic matters on something people buy in quantity and not on a
television. Judge the product in front of you, not the category in the
abstract.

It is worth a customer's attention. A badge is a promise that the thing it
points at is worth stopping for.

HOW MANY

The right side of the banner holds the price and very little else. Two badges
is a comfortable banner, three is full, and more than three is clutter that
makes every one of them weaker. Showing none is a legitimate answer when the
product sells on what it is.

Order matters: put first the one you would want seen if the customer looks at
the banner for half a second.

ABOUT THE ENERGY LABEL

Treat this one differently from the others. In the reference banners the energy
label appears whenever the product has a class at all, including one banner
that shows a G. That pattern suggests it is carried because the product has it
and not because it sells, so a poor class is not a reason to drop it. Judge
whether to lead with it, not whether to carry it.

ABOUT CONDITIONS

Some facts come with a condition attached — a price that only members pay, a
warranty with terms. If you show one of those, the condition has to appear on
the banner. Put it in "finePrint", written in the banner's language, in the one
line of small text that runs along the bottom. If nothing you chose needs a
condition, leave it null.

OUTPUT

In "show", list the facts you are putting on the banner, by their number, best
first, each with one short sentence saying what it adds. In "skip", list the
ones you are leaving off, by their number, each with one short sentence saying
why. Every number must come from the list you were given. A fact belongs in
one list or the other, never both.`,n=g.Ikc({show:g.YOg(g.Ikc({item:g.aig().int().min(1),reason:g.YjP()})),skip:g.YOg(g.Ikc({item:g.aig().int().min(1),reason:g.YjP()})),finePrint:g.YjP().nullable()}),o=new e.Agent({id:"strategist",name:"strategist",instructions:m,model:(0,f.google)(k)}),p=l?new e.Agent({id:"strategist-fallback",name:"strategist-fallback",instructions:m,model:(0,f.google)(l)}):null;function j(a,b){let c=[];if(c.push(`Language: ${h.G2[a.language]}`),c.push(`Product: ${a.name}`),c.push(`Price: ${a.price} kr`),c.push(""),c.push("The copy that is already written:"),c.push(`  headline: ${b.headline}`),c.push(`  support:  ${b.support}`),c.push(`  button:   ${b.cta}`),c.push(""),c.push("Facts available for the banner:"),a.available.forEach((a,b)=>{c.push(`${b+1}. ${h.Qw[a.kind]} — ${a.value}${a.requires?` (${a.requires})`:""}`)}),a.restrictions.length)for(let b of(c.push(""),c.push("Conditions on this product:"),a.restrictions))c.push(`- ${b}`);return c.push(""),c.push("Decide what goes on the banner."),c.join("\n")}d()}catch(a){d(a)}})},10569:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{s:()=>q});var e=c(40721),f=c(18626),g=c(38990),h=c(86994),i=c(15621),j=c(34708),k=c(53108),l=a([e,i]);[e,i]=l.then?(await l)():l;let m=f.Ikc({answers:f.YOg(f.Ikc({item:f.aig().int().describe("The item number as given in the prompt"),choice:f.aig().int().describe("Index of the chosen option, or -1 if none fits"),confidence:f.k5n(["high","low"])}))}),n=f.Ikc({sku:f.YjP(),name:f.YjP(),before:f.YjP().nullable(),after:f.YjP().nullable(),status:f.k5n(["validated","corrected","filled","unresolved","skipped","error"]),confidence:f.k5n(["high","low"]).nullable(),optionsOffered:f.aig(),note:f.YjP().nullable()}),o=a=>a.includes("/"),p=(0,e.createStep)({id:"validate-products",inputSchema:f.Ikc({skus:f.YOg(f.YjP()).describe("Products to check — typically the seed plus the recommendations"),storeDir:f.YjP().optional(),taxonomyDir:f.YjP().optional(),force:f.zMY().default(!1),batchSize:f.aig().int().min(1).max(40).default(10)}),outputSchema:f.Ikc({model:f.YjP(),requested:f.aig(),checked:f.aig(),alreadyClean:f.aig(),validated:f.aig(),corrected:f.aig(),filled:f.aig(),stillUnresolved:f.aig(),errors:f.aig(),requests:f.aig(),usage:f.Ikc({inputTokens:f.aig(),outputTokens:f.aig()}),skippedNoApiKey:f.zMY(),durationMs:f.aig(),outcomes:f.YOg(n)}),execute:async({inputData:a})=>{let b=Date.now(),c=(0,g.C)(a.taxonomyDir),d=new h.q(a.storeDir).load(),e=[...new Set(c.categories.map(a=>a.department))],f=new Map;for(let a of c.categories){let b=f.get(a.department)??[];b.push(a.path),f.set(a.department,b)}let l=new j.wC(j.Kf),n=[],p=0,q=0,r=0,s=0,t=!(0,i.u2)(),u=[];for(let b of a.skus){let e=d.get(b);if(!e){n.push({sku:b,name:"",before:null,after:null,status:"error",confidence:null,optionsOffered:0,note:"SKU not in store"});continue}if(!d.needsValidation(e,c.version,e.feedVersion)&&!a.force){p++;continue}if(t){n.push({sku:b,name:e.name,before:e.category,after:e.category,status:"skipped",confidence:null,optionsOffered:0,note:"no GOOGLE_GENERATIVE_AI_API_KEY in env"});continue}u.push({product:e,options:e.categoryCandidates})}let v=(a,b,c,e)=>{let{product:f,options:g}=a,h=f.category,j=b>=0&&b<g.length?g[b]:null,k=null!==j&&o(j)?j:null;if(null===k&&e)return void e(a);if(null!==k&&null!==h&&h.startsWith(`${k}/`)){f.validationNote=`kept ${h}; model offered the broader ${k}`,f.validatedAt=new Date().toISOString(),f.validatedBy=i.De,d.put(f),n.push({sku:f.sku,name:f.name,before:h,after:h,status:"validated",confidence:"low",optionsOffered:g.length,note:f.validationNote});return}null===k?(f.status="unresolved",f.validationNote="model found no fitting option"):(f.category=k,f.categoryMethod=k===h?f.categoryMethod:"llm",f.status=null===h?"corrected":k===h?"validated":"corrected",f.validationNote=null),f.validatedAt=new Date().toISOString(),f.validatedBy=i.De,d.put(f),n.push({sku:f.sku,name:f.name,before:h,after:f.category,status:null===k?"unresolved":null===h?"filled":k===h?"validated":"corrected",confidence:c,optionsOffered:g.length,note:f.validationNote})},w=async(b,c={})=>{for(let d=0;d<b.length;d+=a.batchSize){let e=b.slice(d,d+a.batchSize),f=c.shared?`Options:
${(e[0]?.options??[]).map((a,b)=>`   ${b} ${a}`).join("\n")}

Products:
${e.map((a,b)=>`${b+1}) ${a.product.name}`).join("\n")}`:e.map((a,b)=>{let c=a.options.map((a,b)=>`   ${b} ${a}`).join("\n");return`${b+1}) ${a.product.name}
${c}`}).join("\n\n"),g=!1;for(let a=0;a<=3&&!g;a++)try{await l.take(),q++;let a=c.shared?"Classify each product below. Every product uses the same numbered list of options.":"Classify each product below. Answer once per item, using that item's own options.",b=await i.hy.generate(`${a}

${f}`,{structuredOutput:{schema:m}}),d=await (0,k.k9)(b);r+=d?.inputTokens??0,s+=d?.outputTokens??0;let h=b.object?.answers;if(!h?.length)throw Error("model returned no answers");let j=new Set;for(let a of h){let b=a.item-1,d=e[b];!d||j.has(b)||(j.add(b),c.onAnswer?c.onAnswer(d,a.choice):v(d,a.choice,a.confidence,c.onRejected??null))}for(let a=0;a<e.length;a++){if(j.has(a))continue;let b=e[a];n.push({sku:b.product.sku,name:b.product.name,before:b.product.category,after:b.product.category,status:"error",confidence:null,optionsOffered:b.options.length,note:"no answer returned for this item"})}g=!0}catch(c){let b=(0,j.Hb)(c,a);if(b&&a<3){await new Promise(a=>setTimeout(a,b.delayMs));continue}for(let a of e)n.push({sku:a.product.sku,name:a.product.name,before:a.product.category,after:a.product.category,status:"error",confidence:null,optionsOffered:a.options.length,note:c instanceof Error?c.message.slice(0,200):String(c)});g=!0}}},x=(a,b)=>{let{product:c,options:e}=a;c.status="unresolved",c.validationNote=b,c.validatedAt=new Date().toISOString(),c.validatedBy=i.De,d.put(c),n.push({sku:c.sku,name:c.name,before:c.category,after:c.category,status:"unresolved",confidence:null,optionsOffered:e.length,note:b})},y=[...u.filter(a=>!a.options.length)],z=u.filter(a=>a.options.length>0);z.length&&await w(z,{onRejected:a=>y.push(a)});let A=new Map;for(let[a,b]of(y.length&&await w(y.map(a=>({product:a.product,options:e})),{shared:!0,onAnswer:(a,b)=>{let c=b>=0&&b<e.length?e[b]:null;if(null===c)return void x(a,"model placed it in no department");let d=A.get(c)??[];d.push(a),A.set(c,d)}}),A)){let c=(f.get(a)??[]).filter(o);if(!c.length){for(let c of b)x(c,`no leaf categories under ${a}`);continue}await w(b.map(a=>({product:a.product,options:c})),{shared:!0})}let B=d.metadata;B&&d.save(B);let C=a=>n.filter(b=>b.status===a).length;return{model:i.De,requested:a.skus.length,checked:n.length,alreadyClean:p,validated:C("validated"),corrected:C("corrected"),filled:C("filled"),stillUnresolved:C("unresolved"),errors:C("error"),requests:q,usage:{inputTokens:r,outputTokens:s},skippedNoApiKey:t,durationMs:Date.now()-b,outcomes:n}}}),q=(0,e.createWorkflow)({id:"validate-products",description:"Confirms or corrects category tags for specific products using the cheapest model.",inputSchema:p.inputSchema,outputSchema:p.outputSchema}).then(p).commit();d()}catch(a){d(a)}})},15621:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{De:()=>i,hy:()=>j,u2:()=>h});var e=c(3410),f=c(25777),g=a([e,f]);[e,f]=g.then?(await g)():g;let i=process.env.TAGGER_MODEL??"gemini-3.5-flash-lite";function h(){return!!(process.env.GOOGLE_GENERATIVE_AI_API_KEY??process.env.GEMINI_API_KEY)}let j=new e.Agent({id:"category-validator",name:"category-validator",description:"Confirms or corrects the category of an Elgiganten product, choosing from a fixed list.",instructions:`You classify products from a Danish electronics retailer (Elgiganten).

You receive a product name and a numbered list of candidate categories from the
retailer's own taxonomy. Pick the ONE option that best describes what the
product actually is.

Rules:
- Answer with the index of your chosen option. Never invent a category.
- Judge what the product IS, not what it is compatible with or themed on.
  A phone case is an accessory, not a phone. A LEGO set of a video game is a
  toy, not a game. Printer ink is ink, not paper.
- Danish compounds are head-final: the last part carries the type.
  "netvaerksswitch" is a switch; "toerretumbler" is a tumble dryer.
- If none of the options fits the product, answer with index -1.
- confidence is "high" only when the name clearly states the product type.
  Use "low" when you are inferring from a brand or model name alone.`,model:(0,f.google)(i)});d()}catch(a){d(a)}})},16081:(a,b,c)=>{c.d(b,{$P:()=>h,Jt:()=>j,tR:()=>k});var d=c(86994);let e=null;function f(a){return a.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")}function g(){return e||(e=new d.q().load().all().map(a=>({sku:a.sku,name:a.name,price:a.price,stockBand:a.stockBand,category:a.category,image:a.image,haystack:`${f(a.name)} ${a.sku.toLowerCase()}`})))}function h(a,b=8){let c=f(a.trim());if(c.length<2)return[];let d=[];for(let a of g())if(a.haystack.includes(c)&&(d.push(a),d.length>=4*b))break;return d.sort((a,b)=>i(a,c)-i(b,c)||a.name.localeCompare(b.name)),d.slice(0,b)}function i(a,b){return a.sku.toLowerCase()===b?0:f(a.name).startsWith(b)?1:2}function j(a){return g().find(b=>b.sku===a)??null}function k(){return g().length}},16423:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{Y:()=>t});var e=c(40721),f=c(18626),g=c(53108),h=c(37592),i=c(30333),j=c(34708),k=c(15621),l=c(60471),m=c(36278),n=a([e,i,k,m]);[e,i,k,m]=n.then?(await n)():n;let o=new Map,p=f.Ikc({brief:f.IeY(),outDir:f.YjP().default(".cache/banners"),name:f.YjP(),verbose:f.zMY().default(!0),webhookUrl:f.YjP().optional(),skipRender:f.zMY().default(!1)}),q=f.Ikc({runId:f.YjP(),skipRender:f.zMY()}),r=(0,e.createStep)({id:"art-direction",inputSchema:p,outputSchema:q,execute:async({inputData:a,runId:b})=>{if(!(0,k.u2)())throw Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");let c=new h.D(b,{verbose:a.verbose,webhookUrl:a.webhookUrl,logger:i.n}),d={events:c,cost:new g.F6,throttle:new j.wC,brief:a.brief,direction:function(a){let{headline:b,accent:c}=a.copy,d=c?b.indexOf(c):-1;return{headlineLines:d>0?[b.slice(0,d).trim(),b.slice(d).trim()].filter(Boolean):[b],productScale:"large",rationale:"fallback layout: the model did not return a usable one"}}(a.brief),issues:[],render:null,renderError:null,outDir:a.outDir,name:a.name};o.set(b,d),c.emit("run.started",{sku:d.brief.product.sku,language:d.brief.language});let e=(0,m.RM)(d.brief),f={structuredOutput:{schema:m.wV}},l=[];for(let c=0;c<2;c++){let h,i=l.length?`${e}

Your previous layout was rejected:
${l.map(a=>`- ${a}`).join("\n")}

Do it again, fixing exactly those problems.`:e;await d.throttle.take();let k=Date.now();try{h=await (0,j.bD)(()=>m._x.generate(i,f),{onRetry:a=>d.events.emit("model.retry",{stage:"art-direction",model:m.BO,...a})})}catch(a){if(!m.cX||null===(0,j.Hb)(a,0))throw a;d.events.emit("model.fallback",{stage:"art-direction",from:m.BO,to:m.Qx}),await d.throttle.take(),h=await (0,j.bD)(()=>m.cX.generate(i,f),{})}d.cost.record("art-direction",m.BO,await (0,g.k9)(h),Date.now()-k);let n=h.object;if(!n){l=["the model returned nothing in the expected shape"],d.issues.push(...l);continue}let o=function(a,b){let c=[],d=(0,m.d_)(a.headlineLines,b.copy.headline);d&&c.push(d),a.headlineLines.some(a=>!a.trim())&&c.push("one of the lines is empty");let e=b.copy.accent.trim().toLowerCase();if(e&&!a.headlineLines.some(a=>a.toLowerCase().includes(e))&&c.push(`the accent "${b.copy.accent}" is split across lines instead of sitting inside one`),a.headlineLines.length>1){let b=a.headlineLines.map(a=>a.trim().length),d=Math.max(...b);a.headlineLines.forEach((a,e)=>{let f=a.trim().split(/\s+/).filter(Boolean).length;1===f&&b[e]<.5*d&&c.push(`line ${e+1} is the single word "${a.trim()}", stranded next to much longer lines`)})}return c}(n,d.brief);if(!o.length)return d.direction=n,d.events.emit("copy.written",{stage:"art-direction",attempt:c+1,lines:n.headlineLines,scale:n.productScale}),{runId:b,skipRender:a.skipRender};l=o,d.issues.push(...o),d.events.emit("copy.rejected",{stage:"art-direction",attempt:c+1,issues:o})}return d.events.emit("copy.rejected",{stage:"art-direction",issues:["out of attempts, using the fallback layout"]}),{runId:b,skipRender:a.skipRender}}}),s=(0,e.createStep)({id:"render",inputSchema:q,outputSchema:f.IeY(),execute:async({inputData:a})=>{let b=function(a){let b=o.get(a);if(!b)throw Error(`no context for run ${a}`);return b}(a.runId);if(a.skipRender)b.events.emit("run.completed",{png:null});else try{b.render=await (0,l.D8)(b.brief,b.direction,{outDir:b.outDir,name:b.name}),b.events.emit("run.completed",{png:b.render.png})}catch(a){b.renderError=a instanceof Error?a.message:String(a),b.events.emit("run.failed",{reason:b.renderError})}await b.events.flush();let c={runId:a.runId,direction:b.direction,issues:b.issues,render:b.render,renderError:b.renderError,cost:b.cost.summary(),events:b.events.timeline()};return o.delete(a.runId),c}}),t=(0,e.createWorkflow)({id:"art-direct",description:"Decides the banner layout and renders the 2048\xd7768 image",inputSchema:p,outputSchema:f.IeY()}).then(r).then(s).commit();d()}catch(a){d(a)}})},17492:(a,b,c)=>{c.d(b,{G2:()=>d,IB:()=>e,Qw:()=>f,Uw:()=>k,ZN:()=>h,_x:()=>j,zL:()=>g});let d={da:"Danish",sv:"Swedish",en:"English"},e={da:["Se tilbud","K\xf8b nu","L\xe6s mere"],sv:["Klicka h\xe4r","Se erbjudandet","K\xf6p nu","L\xe4s mer"],en:["See offer","Buy now","Read more","Shop now"]},f={energy:"EU energy label",saving:"savings badge",oldPrice:"previous price beside the current one",clearance:"end-of-line badge",multibuy:"multi-buy mechanic",warranty:"extended warranty",memberPrice:"member price"},g={da:"SPAR",sv:"SPARA",en:"SAVE"},h={da:"F\xf8r",sv:"F\xf6rr",en:"Was"},i=/^(?:rest\s+)?spar\s+([0-9.,]+)$/i;function j(a,b){let c=[],d=[],e=[],f=a.salesPoint;a.energyClass&&c.push({kind:"energy",value:a.energyClass,source:"EnergyEfficiencyClass",requires:null});let g=function(a){if(null!==a.oldPrice&&a.oldPrice<=a.price)return{ok:!1,why:`the feed's previous price (${a.oldPrice} kr) is not above the current one (${a.price} kr), so there is no saving to show`};if(null===a.saveAmount||a.saveAmount<=0)return{ok:!1,why:"the feed states no saving for this product"};if(null===a.oldPrice)return{ok:!1,why:"there is no previous price to measure the saving against"};let b=function(a){if(!a)return null;let b=i.exec(a.trim());if(!b?.[1])return null;let c=Number(b[1].replace(/\./g,"").replace(",","."));return Number.isFinite(c)?c:null}(a.salesPoint);return null!==b&&Math.abs(b-a.saveAmount)>=1?{ok:!1,why:`the feed disagrees with itself: the label says ${b} and the saving field says ${a.saveAmount}`}:{ok:!0,why:""}}(a);g.ok&&null!==a.saveAmount&&null!==a.oldPrice?(c.push({kind:"saving",value:`${a.saveAmount} kr${a.discountPct>0?` (${a.discountPct}%)`:""}`,amount:a.saveAmount,pct:a.discountPct,source:"SavePriceAmount",requires:null}),c.push({kind:"oldPrice",value:`${a.oldPrice} kr`,amount:a.oldPrice,source:"Price + SavePriceAmount",requires:null})):(d.push({kind:"saving",why:g.why}),d.push({kind:"oldPrice",why:g.why}));let h=function(a){if(!a)return null;let b=/klubpris\s+([0-9.,]+)/i.exec(a);if(!b?.[1])return null;let c=Number(b[1].replace(/\./g,"").replace(",","."));return Number.isFinite(c)?c:null}(f);null!==h&&(c.push({kind:"memberPrice",value:`${h} kr for members`,amount:h,source:"SalesPoint",requires:"the banner must say this price is for members"}),e.push(`${a.price} kr is the price without membership; ${h} kr is the member price and may never be shown as the plain price`)),f&&/^rest/i.test(f.trim())&&c.push({kind:"clearance",value:f.trim(),source:"SalesPoint",requires:null}),f&&/betal for/i.test(f)&&c.push({kind:"multibuy",value:f.trim(),source:"SalesPoint",requires:null});let j=function(a){if(!a)return null;let b=/([0-9]+)\s*års?\s*garanti/i.exec(a);return b?.[1]?`${b[1]} years`:null}(f);j&&c.push({kind:"warranty",value:j,source:"SalesPoint",requires:"terms apply, so the banner must carry the asterisk"});let k=function(a){if(!a)return null;let b=/maks\.?\s*([0-9]+)/i.exec(a);return b?.[1]?`at most ${b[1]} per customer`:null}(f);k&&e.push(`purchase is limited to ${k}`),f&&/pant/i.test(f)&&e.push("the price does not include the deposit"),f&&/frontplade/i.test(f)&&e.push("the product ships without a front plate");let l=[String(a.price)];for(let b of(g.ok&&null!==a.saveAmount&&null!==a.oldPrice&&l.push(String(a.saveAmount),String(a.oldPrice),String(a.discountPct)),null!==h&&l.push(String(h)),a.name.match(/\d+/g)??[]))l.push(b);return{sku:a.sku,name:a.name,brand:a.brand,category:a.category,language:b,price:a.price,stockBand:a.stockBand,image:a.image,available:c,blocked:d,restrictions:e,allowedNumbers:[...new Set(l)]}}function k(a,b){let c=a.match(/\d[\d.,]*/g)??[],d=[];for(let a of c){let c=a.replace(/[.,]$/,"");if(c.length<2)continue;let e=c.replace(/[.,]/g,"");b.allowedNumbers.some(a=>a.replace(/[.,]/g,"")===e)||d.push(c)}return[...new Set(d)]}},19786:(a,b,c)=>{c.d(b,{su:()=>i});var d=c(4701),e=c(48356);let f={synonym:100,phrase:3,exact:2,compound:1.3},g=new Set(["til","og","for","med","uden","af","i","pa"]);class h{constructor(a){for(let b of(this.taxonomy=a,this.terms=new Map,this.multiWord=[],this.docCount=0,this.fitted=!1,a.categories)){if(!b.path.includes("/"))continue;let a=(0,e.a)(b.slug.replace(/-/g," "));if(!a.length||(this.register(a.join(" "),a,b.path),1===a.length))continue;let c=b.path.split("/").at(-2),d=c?(0,e.a)(c.replace(/-/g," ")):[];if(d.length&&d[0]===a[0])continue;let f=function(a){let b=a.findIndex(a=>g.has(a));return(b>0?a.slice(0,b):a).at(-1)??null}(a);f&&f.length>=2&&this.register(f,[f],b.path)}}register(a,b,c){let d=this.terms.get(a);if(d){d.paths.includes(c)||d.paths.push(c);return}this.terms.set(a,{term:a,termWords:b,paths:[c],df:0,idf:0})}fit(a){for(let b of(this.docCount=a.length,this.terms.values()))b.df=0;for(let b of a)for(let a of this.rawMatches(b))a.df++;for(let a of this.terms.values())a.idf=a.df>0?Math.log(this.docCount/a.df):0;return this.multiWord=[...this.terms.values()].filter(a=>a.termWords.length>1),this.fitted=!0,this}rawMatches(a){let b=new Set,c=(0,e.a)(a);if(!c.length)return b;let d=new Set(c);for(let a of c){let c=this.terms.get(a);c&&b.add(c);for(let c=1;c<=a.length-4;c++){let d=a.slice(c),e=this.terms.get(d);e&&1===e.termWords.length&&b.add(e)}}let f=` ${c.join(" ")} `;for(let a of this.multiWord.length?this.multiWord:[...this.terms.values()].filter(a=>a.termWords.length>1))d.has(a.termWords[a.termWords.length-1])&&f.includes(` ${a.term} `)&&b.add(a);return b}synonymFor(a){let b=new Set(a),c=b=>b.find(b=>a.some(a=>a===b||a.length>b.length&&a.endsWith(b)));for(let a of this.taxonomy.synonyms){let d=a.words?.find(a=>b.has(a)),e=d?void 0:c(a.suffixes??[]),f=d??e;if(!(!f||a.requireAny?.length&&!a.requireAny.some(a=>b.has(a)))&&!a.excludeAny?.some(a=>b.has(a)))return{path:a.path,term:f}}return null}tag(a){if(!this.fitted)throw Error("CategoryTagger.fit() must run before tag()");let b=(0,e.a)(a);if(!b.length)return null;let c=new Set(b),d=` ${b.join(" ")} `,g=.15*this.docCount,h=[],i=this.synonymFor(b);i&&h.push({path:i.path,score:f.synonym,kind:"synonym",term:i.term});let j=(a,c,d)=>{if(a.df>g||a.idf<=0)return;let e=b.length>1?1+.3*(d/(b.length-1)):1,i=Math.sqrt(a.paths.length),j=a.idf*f[c]*e/i;for(let b of this.rankPaths(a))h.push({path:b,score:j,kind:c,term:a.term})};for(let a=0;a<b.length;a++){let c=b[a],d=this.terms.get(c);d&&j(d,"exact",a);for(let b=1;b<=c.length-4;b++){let d=this.terms.get(c.slice(b));d&&1===d.termWords.length&&j(d,"compound",a)}}for(let a of this.multiWord){if(!c.has(a.termWords[a.termWords.length-1]))continue;let e=d.indexOf(` ${a.term} `);e<0||j(a,"phrase",Math.min(d.slice(0,e+1).split(" ").length-1,b.length-1))}if(!h.length)return null;h.sort((a,b)=>b.score-a.score);let k=h[0],l=[];for(let a of h)if(l.includes(a.path)||l.push(a.path),5===l.length)break;let m=h.find(a=>a.path!==k.path);return{path:k.path,score:Number(k.score.toFixed(4)),kind:k.kind,term:k.term,margin:Number((k.score-(m?.score??0)).toFixed(4)),candidates:l}}rankPaths(a){return[...a.paths].sort((b,c)=>{let d=+(b.slice(b.lastIndexOf("/")+1).replace(/-/g," ")!==a.term),e=+(c.slice(c.lastIndexOf("/")+1).replace(/-/g," ")!==a.term);return d!==e?d-e:c.split("/").length-b.split("/").length})}stats(){let a=[...this.terms.values()].filter(a=>a.df>0&&a.df<=.15*this.docCount),b=[...this.terms.values()].filter(a=>a.df>.15*this.docCount).sort((a,b)=>b.df-a.df);return{terms:this.terms.size,discriminating:a.length,droppedAsTooCommon:b.map(a=>({term:a.term,df:a.df}))}}}function i(a,b,c){let f=a.map(a=>a["product-name"]??""),g=new h(b).fit(f),i={},j={},k=0,l=0,m=a.map(a=>{let f=a["product-name"]??"",h=(0,d.CX)(a),m=g.tag(f),n=function(a,b){let c=(0,e.a)(a);for(let a of[4,3,2,1])for(let d=0;d+a<=c.length;d++){let e=c.slice(d,d+a).join(" ");if(!(e.length<3)&&b.brandSet.has(e))return e}return null}(f,b);return n&&k++,m&&(l++,i[m.path.split("/")[0]]=(i[m.path.split("/")[0]]??0)+1,j[m.kind]=(j[m.kind]??0)+1),{sku:a.SKU,name:f,...h,brand:n,category:m?.path??null,categoryScore:m?.score??null,categoryMargin:m?.margin??null,categoryMethod:m?.kind??null,categoryCandidates:m?.candidates??[],tier:null,tierConfidence:null,tierBy:null,tierAt:null,tierCategory:null,status:m?"auto":"unresolved",validatedAt:null,validatedBy:null,validationNote:null,autoCategory:m?.path??null,taxonomyVersion:b.version,feedVersion:c}});return{products:m,tagger:g,stats:{total:m.length,withBrand:k,withCategory:l,unresolved:m.length-l,byDepartment:i,byMethod:j}}}},23168:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{w:()=>i});var e=c(73024),f=c(12650),g=a([f]);f=(g.then?(await g)():g)[0];let h=process.env.MASTRA_DB_URL??"file:.cache/mastra.db";if(h.startsWith("file:")){let a=h.slice(5).split("/").slice(0,-1).join("/");a&&(0,e.mkdirSync)(a,{recursive:!0})}let i=new f.LibSQLStore({id:"banner-factory",url:h,...process.env.MASTRA_DB_AUTH_TOKEN?{authToken:process.env.MASTRA_DB_AUTH_TOKEN}:{}});d()}catch(a){d(a)}})},30333:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{n:()=>h});var e=c(22769),f=a([e]);e=(f.then?(await f)():f)[0];let g=new Set(Object.values(e.LogLevel)).has(process.env.MASTRA_LOG_LEVEL??"")?process.env.MASTRA_LOG_LEVEL:e.LogLevel.INFO,h=new e.ConsoleLogger({name:"banner-factory",level:g,filter:function(a){return!(g!==e.LogLevel.DEBUG&&a.level===e.LogLevel.ERROR&&/upstream llm api error/i.test(a.message))||!a.args.some(a=>"object"==typeof a&&null!==a&&("isRetryable"in a&&!0===a.isRetryable||"error"in a&&"object"==typeof a.error&&a.error?.isRetryable===!0))}});d()}catch(a){d(a)}})},34420:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{IN:()=>n,LU:()=>o,Ri:()=>p,hs:()=>k,mN:()=>j,y2:()=>l});var e=c(3410),f=c(25777),g=c(18626),h=c(17492),i=a([e,f]);[e,f]=i.then?(await i)():i;let k=process.env.COPYWRITER_MODEL??process.env.TAGGER_MODEL??"gemini-3.5-flash-lite",l=process.env.COPYWRITER_FALLBACK_MODEL??"",m=`You write banner copy for Elgiganten, a Nordic electronics and appliance
retailer. One hero banner, one product, three lines of text.

WHO IS SPEAKING

Elgiganten is the trusted advisor: an honest friend who listens more than they
talk and always has a good answer. Write like a store employee who likes the
customer, not like a billboard shouting at them. Friendly, relaxed and down to
earth. Never pushy, never pretentious. Warm, light humour is welcome when it
shows insight into real life, but never sarcasm and never a joke at anyone's
expense. Tech is complicated and your job is to make it easy, so plain words
beat jargon every time.

THE THREE LINES, AND THE JOB OF EACH

headline — the main idea, and it must be about THIS product. A headline that
would sit just as well on any other product in the category reads as generic
and machine-made. Name the product or the one benefit that matters most about
it. A concrete true fact beats a vague promise. A few words: aim for 30 to 45
characters and never go past 60. No full stop at the end. A question mark is
allowed and welcome, because this brand likes to ask questions.

support — a SECOND idea, not the headline again in other words. Say plainly
what the product is or what it does for the person. One sentence.

cta — the button. You will be given the options this brand uses in the
banner's language. Copy one of them exactly, including its capitalisation and
its accents. Do not write your own, and never leave it in another language than
the one you are writing in.

accent — one continuous run of words copied EXACTLY from your own headline. In
every real banner one phrase of the headline is set in green while the rest is
white, and this is that phrase. Pick the words carrying the idea. It must
appear in the headline character for character, and it must not be the whole
headline.

WHAT YOU ARE ALLOWED TO SAY

You will be given the product and a list of facts. That list is everything that
is true and permitted. Prices, savings, warranty, delivery, stock and features
must never be invented, and a number that is not in the facts must not appear
in your text. If the facts carry a restriction, your copy must not contradict
it: do not write as though a limited product were unlimited, and do not present
a member price as though everyone paid it.

Benefits over specifications. Say what the product does for the person. Raw
measurements, model codes and features every competitor also has are not
interesting. Write about what is actually being sold — ink is not paper, and a
LEGO set is not the film it is themed on.

If there is only one thing worth saying, say one thing. Less is fine.

Do not manufacture urgency. No "Hurry", no "Last chance", no exclamation marks
piled up, no empty superlatives. The customer is an adult.

LANGUAGE

Write in the language you are asked for, as a native writes it, not as a
translation of the Danish feed. The product's own model name stays as it is.
Prices in this catalogue are always Danish kroner, whatever the language.

The product data in front of you is Danish, and Danish is close enough to
Swedish that words slide across without looking wrong. They do look wrong to a
Swede. Writing Swedish, it is spara and not spar, erbjudande and not tilbud,
k\xf6pa and not k\xf8be, sk\xe4rm and not sk\xe6rm; Swedish uses \xf6 and \xe4 where Danish uses
\xf8 and \xe6. Writing English, nothing Scandinavian survives except the product's
own name and the currency. Read your line back and ask whose language it is.

OUTPUT

Return headline, accent, support and cta. In "rationale", one short sentence on
what you decided to lead with and why — this is read by a human reviewing the
banner, not shown to the customer.`,n=g.Ikc({headline:g.YjP(),accent:g.YjP(),support:g.YjP(),cta:g.YjP(),rationale:g.YjP()}),o=new e.Agent({id:"copywriter",name:"copywriter",instructions:m,model:(0,f.google)(k)}),p=l?new e.Agent({id:"copywriter-fallback",name:"copywriter-fallback",instructions:m,model:(0,f.google)(l)}):null;function j(a){let b=[];if(b.push(`Language: ${h.G2[a.language]}`),b.push(""),b.push(`Product: ${a.name}`),a.brand&&b.push(`Brand: ${a.brand}`),b.push(`Price: ${a.price} kr`),a.available.length)for(let c of(b.push(""),b.push("Facts you may use:"),a.available))b.push(`- ${c.kind}: ${c.value}${c.requires?` — ${c.requires}`:""}`);if(a.restrictions.length)for(let c of(b.push(""),b.push("Conditions your copy must not contradict:"),a.restrictions))b.push(`- ${c}`);return b.push(""),b.push(`Button options (copy one exactly): ${h.IB[a.language].join(" | ")}`),b.push(""),b.push("Write the banner. Every number you use must come from the facts above or from the product name."),b.join("\n")}d()}catch(a){d(a)}})},34708:(a,b,c)=>{c.d(b,{Hb:()=>f,Kf:()=>d,bD:()=>g,wC:()=>e});let d=15;class e{constructor(a=d){this.limit=a,this.times=[]}async take(){for(;;){let a=Date.now();if(this.times=this.times.filter(b=>a-b<6e4),this.times.length<this.limit)return void this.times.push(a);let b=6e4-(a-this.times[0])+250;await new Promise(a=>setTimeout(a,b))}}}function f(a,b){let c=a instanceof Error?a.message:String(a),d=a?.statusCode;if(402===d||/prepayment|credits are depleted|billing details|check your plan/i.test(c))return null;if(/quota|rate.?limit|429/i.test(c)||429===d){let a=c.match(/retry in ([\d.]+)s/i);return{kind:"rate-limit",delayMs:a?Math.ceil(1e3*Number(a[1]))+500:2e4}}return/\b50[0234]\b|unavailable|high demand|overloaded|internal error|deadline exceeded|ECONNRESET|ETIMEDOUT|fetch failed/i.test(c)||"number"==typeof d&&d>=500?{kind:"transient",delayMs:2e3*2**b+Math.floor(600*Math.random())}:null}async function g(a,b={}){let c=b.attempts??5;for(let d=0;;d++)try{return await a()}catch(e){let a=f(e,d);if(!a||d>=c-1)throw e;b.onRetry?.({attempt:d+1,kind:a.kind,delayMs:a.delayMs,message:e instanceof Error?e.message.slice(0,120):String(e).slice(0,120)}),await new Promise(b=>setTimeout(b,a.delayMs))}}},36278:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{BO:()=>k,Qx:()=>l,RM:()=>i,_x:()=>o,cX:()=>p,d_:()=>j,wV:()=>n});var e=c(3410),f=c(25777),g=c(18626),h=a([e,f]);[e,f]=h.then?(await h)():h;let k=process.env.ART_DIRECTOR_MODEL??process.env.TAGGER_MODEL??"gemini-3.5-flash-lite",l=process.env.ART_DIRECTOR_FALLBACK_MODEL??"",m=`You are the art director for an Elgiganten hero banner, 2048 by 768. The
product is chosen, the copy is written and the badges are decided. The grid,
the colours and the type are fixed brand assets and are not yours to change.
Two things are yours.

HOW THE HEADLINE BREAKS

The headline is set large, in upper case, in a column down the left of the
banner. You decide how it breaks across lines: one, two or at most three.

Break where the sense breaks. A line should end where a speaker would pause,
and the phrase carrying the idea should land together on one line rather than
be split across two. Never strand a single short word on a line of its own,
and never separate a number from the thing it counts.

The lines are set left-aligned, so a long line followed by a much shorter one
looks unbalanced. Aim for lines of a similar length, with the longer one first
when they cannot match.

One more constraint, and it is hard: the phrase marked as the accent is set in
a different colour, and it has to sit inside ONE line. If keeping it whole
forces an awkward break, say so in your rationale and keep the accent whole
anyway.

Return the lines as they should appear. Together they must be exactly the
headline you were given, word for word, with nothing added, nothing dropped
and nothing reworded. You are breaking a line, not rewriting a sentence.

HOW BIG THE PRODUCT SITS

The product photograph is cut out and placed on the navy in the middle of the
banner. The whole product is always visible — it is never cropped by the edge
of the canvas, and there is always air above and below it. You are choosing
how much of that room it takes:

  fill    it should dominate — a large television, a fridge, a tall appliance
  large   the normal choice for a laptop, a console, a kitchen machine
  medium  a phone, a camera, a pair of headphones
  small   something genuinely small, where blowing it up shows only texture

Think about how the object is met in life. Something a person stands in front
of can be commanding. Something held in the hand looks absurd at two metres
tall, and shrinking a small object does not make it look small — it makes the
banner look empty. When in doubt choose large.

OUTPUT

headlineLines, productScale, and one short sentence in rationale saying why
you broke the headline where you did.`,n=g.Ikc({headlineLines:g.YOg(g.YjP()).min(1).max(3),productScale:g.k5n(["fill","large","medium","small"]),rationale:g.YjP()}),o=new e.Agent({id:"art-director",name:"art-director",instructions:m,model:(0,f.google)(k)}),p=l?new e.Agent({id:"art-director-fallback",name:"art-director-fallback",instructions:m,model:(0,f.google)(l)}):null;function i(a){let b=[];return b.push(`Product: ${a.product.name}`),a.product.brand&&b.push(`Brand: ${a.product.brand}`),b.push(`Price: ${a.product.priceText}`),b.push(""),b.push(`Headline: ${a.copy.headline}`),b.push(`Accent phrase, which must stay inside one line: ${a.copy.accent}`),b.push(`Supporting line: ${a.copy.support}`),b.push(""),b.push(a.badges.length?`Badges going in the side band: ${a.badges.map(a=>`${a.kind} (${a.value})`).join(", ")}`:"No badges in the side band."),b.push(""),b.push("Break the headline and size the product."),b.join("\n")}function j(a,b){let c=a=>a.trim().toLowerCase().split(/\s+/).filter(Boolean),d=a.flatMap(c),e=c(b);return d.join(" ")===e.join(" ")?null:`the lines read "${d.join(" ")}" but the headline is "${e.join(" ")}"`}d()}catch(a){d(a)}})},37592:(a,b,c)=>{c.d(b,{D:()=>f,V:()=>e});let d=new Map;function e(a,b){let c=d.get(a);return c||(c=new Set,d.set(a,c)),c.add(b),()=>{let c=d.get(a);c&&(c.delete(b),c.size||d.delete(a))}}class f{constructor(a,b={}){this.runId=a,this.opts=b,this.events=[],this.pending=[],this.startedAt=Date.now(),this.seq=0,this.failures=[],this.webhookUrl=b.webhookUrl??process.env.BANNER_WEBHOOK_URL??void 0}emit(a,b={}){let c={runId:this.runId,seq:++this.seq,stage:a,at:new Date().toISOString(),elapsedMs:Date.now()-this.startedAt,data:b};if(this.events.push(c),this.opts.verbose){let d=Object.entries(b).map(([a,b])=>`${a}=${"object"==typeof b?JSON.stringify(b):String(b)}`).join(" "),e=`[${String(c.elapsedMs).padStart(6)}ms] ${a.padEnd(24)} ${d}`;this.opts.logger?(this.opts.logger.info(e),this.opts.logger.debug(`event ${a}`,c)):console.log(`  ${e}`)}let e=d.get(this.runId);if(e)for(let a of e)try{a(c)}catch{}return this.webhookUrl&&this.pending.push(this.post(this.webhookUrl,c)),c}async post(a,b){try{let c=await fetch(a,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b),signal:AbortSignal.timeout(this.opts.timeoutMs??3e3)});c.ok||this.failures.push(`${b.stage}: HTTP ${c.status}`)}catch(a){this.failures.push(`${b.stage}: ${a instanceof Error?a.message:String(a)}`)}}async flush(){return await Promise.allSettled(this.pending),this.pending=[],{delivered:this.events.length-this.failures.length,failures:[...this.failures]}}timeline(){return[...this.events]}get webhookConfigured(){return!!this.webhookUrl}}},38990:(a,b,c)=>{c.d(b,{C:()=>f});var d=c(73024),e=c(77598);function f(a="data/taxonomy"){let b=(0,d.readFileSync)(`${a}/categories.json`,"utf8"),c=(0,d.readFileSync)(`${a}/brands.json`,"utf8"),g=(0,d.readFileSync)(`${a}/synonyms.json`,"utf8"),h=(0,e.createHash)("sha256").update(b).update(c).update(g).digest("hex").slice(0,12),i=JSON.parse(b).tree,j=[],k=(a,b)=>{for(let c of a){let a=[...b,c.slug];j.push({slug:c.slug,path:a.join("/"),depth:a.length,department:a[0],isLeaf:!c.children?.length}),c.children?.length&&k(c.children,a)}};k(i,[]);let l=JSON.parse(c).brands,m=JSON.parse(g).entries,n=new Map(j.map(a=>[a.path,a])),o=m.filter(a=>!n.has(a.path));if(o.length)throw Error(`synonyms.json points at ${o.length} path(s) that are not in categories.json:
`+o.map(a=>`  ${a.path}`).join("\n"));return{version:h,categories:j,byPath:n,brands:l,brandSet:new Set(l.map(a=>a.replace(/-/g," "))),synonyms:m}}},48356:(a,b,c)=>{c.d(b,{A:()=>e,a:()=>f});let d={ø:"o",æ:"a",å:"a",ö:"o",ä:"a",ü:"u",é:"e",è:"e",ê:"e",á:"a",à:"a",í:"i",ó:"o",ú:"u",ñ:"n",ç:"c",ß:"ss"};function e(a){let b=a.toLowerCase();for(let[a,c]of Object.entries(d))b=b.replaceAll(a,c);return b.replace(/[^a-z0-9]+/g," ").trim()}function f(a){let b=e(a);return b?b.split(" "):[]}},53108:(a,b,c)=>{c.d(b,{F6:()=>e,k9:()=>f});let d=a=>{if(void 0===a||""===a.trim())return null;let b=Number(a);return Number.isFinite(b)?b:null};class e{record(a,b,c,e){let f=c?.inputTokens??0,g=c?.outputTokens??0,h=c?.cachedInputTokens??0,i=function(a){let b=a.startsWith("gemini")?"GEMINI":null;if(!b)return null;let c=d(process.env[`${b}_PRICE_IN_PER_MTOK`]),e=d(process.env[`${b}_PRICE_OUT_PER_MTOK`]);return null===c||null===e?null:{inPerMTok:c,outPerMTok:e}}(b),j=i?f/1e6*i.inPerMTok+g/1e6*i.outPerMTok:null;return this.records.push({stage:a,model:b,inputTokens:f,outputTokens:g,cachedInputTokens:h,usd:j,durationMs:e}),this.records[this.records.length-1]}saved(a=1){this.savedCalls+=a}summary(){let a=this.records.reduce((a,b)=>a+b.inputTokens,0),b=this.records.reduce((a,b)=>a+b.outputTokens,0),c=this.records.filter(a=>null!==a.usd),d=c.length?c.reduce((a,b)=>a+(b.usd??0),0):null,e={};for(let a of this.records){let b=e[a.stage]??={calls:0,inputTokens:0,outputTokens:0};b.calls++,b.inputTokens+=a.inputTokens,b.outputTokens+=a.outputTokens}return{calls:this.records.length,callsAvoidedByCache:this.savedCalls,inputTokens:a,outputTokens:b,totalTokens:a+b,usd:d,priced:c.length===this.records.length&&this.records.length>0,modelMs:this.records.reduce((a,b)=>a+b.durationMs,0),byStage:e,records:this.records}}constructor(){this.records=[],this.savedCalls=0}}async function f(a){let b=await a?.usage;if(!b||"object"!=typeof b)return;let c=a=>"number"==typeof a&&Number.isFinite(a)?a:0,d=c(b.inputTokens??b.promptTokens),e=c(b.outputTokens??b.completionTokens);return{inputTokens:d,outputTokens:e,totalTokens:c(b.totalTokens)||d+e,..."number"==typeof b.cachedInputTokens?{cachedInputTokens:b.cachedInputTokens}:{}}}},58086:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{Sw:()=>n,iA:()=>m,iv:()=>k,jU:()=>j,kK:()=>o,rE:()=>i});var e=c(3410),f=c(25777),g=c(18626),h=a([e,f]);[e,f]=h.then?(await h)():h;let j=process.env.TIER_MODEL??process.env.TAGGER_MODEL??"gemini-3.5-flash-lite",k=process.env.TIER_FALLBACK_MODEL??"",l=`You are a product specialist for Elgiganten, a Nordic electronics and appliance
retailer. You know how brands and product lines are positioned in the Nordic
market, across every kind of product this retailer sells.

You receive a category path and a numbered list of products from that
category. Assign each one a premium tier from 0 to 3.

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

- Judge WITHIN the given category. The question is never "is this expensive for
  a product", it is "where does this sit among products of this kind".
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

Answer once per item, using the item number you were given. confidence is
"high" only when the brand and line clearly place the product, and "low" when
you are inferring from a model code alone.`,m=g.Ikc({answers:g.YOg(g.Ikc({item:g.aig().int().describe("The item number as given in the prompt"),tier:g.aig().int().min(0).max(3),confidence:g.k5n(["high","low"])}))}),n=new e.Agent({id:"tier-classifier",name:"tier-classifier",description:"Assigns a 0-3 premium tier to products within a single category.",instructions:l,model:(0,f.google)(j)}),o=k?new e.Agent({id:"tier-classifier-fallback",name:"tier-classifier-fallback",description:n.getDescription(),instructions:l,model:(0,f.google)(k)}):null;function i(a,b,c=[]){let d=c.length?`
Every brand sold in this category, so you can place these against the whole
field and not just against each other:

  ${c.join(", ")}
`:"",e=b.map((a,b)=>`${b+1}) ${a}`).join("\n");return`Category: ${a}
${d}
Products:

${e}`}d()}catch(a){d(a)}})},60471:(a,b,c)=>{c.d(b,{D8:()=>s});var d=c(73024),e=c(31421),f=c(57975),g=c(76760),h=c(87659),i=c(17492);let j=h.Ab.navyDark.replace("#",""),k=(0,f.promisify)(e.execFile),l=process.env.CHROME_PATH??"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",m=(0,g.resolve)(process.env.BANNER_ROOT??process.cwd()),n={A:"#00a650",B:"#4cb847",C:"#bfd630",D:"#fff200",E:"#fdb913",F:"#f37021",G:"#ed1c24"},o={fill:1,large:.92,medium:.78,small:.6},p=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function q(a,b){if("energy"===a.kind){var c=a.value;let b=n[c.trim().charAt(0).toUpperCase()]??"#00a650";return`<div class="energy">
    <div class="arrow" style="--c:${b}">${p(c)}</div>
    <div class="scale"><span>A</span><span class="arrowhead">↑</span><span>G</span></div>
  </div>`}return"oldPrice"===a.kind?"":"clearance"===a.kind?`<div class="circle">${p(a.value)}</div>`:"saving"===a.kind&&void 0!==a.amount?`<div class="bar">${i.zL[b]} ${p((0,h.BC)(a.amount))}</div>`:"memberPrice"===a.kind&&void 0!==a.amount?`<div class="bar">${p(a.value.replace(/^[0-9.,]+ kr/,(0,h.BC)(a.amount)))}</div>`:`<div class="bar">${p(a.value)}</div>`}async function r(a,b){if((0,d.existsSync)(b))return;let c=await fetch(a,{signal:AbortSignal.timeout(2e4)});if(!c.ok)throw Error(`product image: HTTP ${c.status}`);(0,d.writeFileSync)(b,Buffer.from(await c.arrayBuffer()))}async function s(a,b,c){(0,d.mkdirSync)(c.outDir,{recursive:!0});let e=(0,g.resolve)(c.outDir),f=(a.product.image.split(".").pop()??"jpg").split("?")[0],n=`${e}/${c.name}-product.${f}`;await r(a.product.image,n);let s=`${e}/${c.name}.html`,t=`${e}/${c.name}.png`;if((0,d.writeFileSync)(s,function(a,b,c){let d=a.design.palette,e=a.design.zones,{width:f,height:g}=a.canvas,j=b.headlineLines.map(b=>`<div class="hl">${function(a,b){let c=b.trim();if(!c)return p(a);let d=a.toLowerCase().indexOf(c.toLowerCase());return -1===d?p(a):p(a.slice(0,d))+`<span class="accent">${p(a.slice(d,d+c.length))}</span>`+p(a.slice(d+c.length))}(b,a.copy.accent)}</div>`).join(""),k=a.badges.find(a=>"oldPrice"===a.kind),l=a=>"energy"!==a.kind&&"clearance"!==a.kind,n=a.badges.filter(a=>!l(a)).map(b=>q(b,a.language)).join(""),r=a.badges.filter(l).map(b=>q(b,a.language)).join(""),s=Math.round(Math.min(Math.round(g*h.Qu.maxFraction),g-h.Qu.marginTop-h.Qu.marginBottom)*o[b.productScale]),t=Math.round(e.product.width*o[b.productScale]);return`<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family:"ElkHead"; src:url("file://${m}/brand/fonts/ElkjopAIntHeadline-Regular.otf") format("opentype"); }
  @font-face { font-family:"ElkBody"; src:url("file://${m}/brand/fonts/ElkjopAIntBodytext-Regular.otf") format("opentype"); font-weight:400; }
  @font-face { font-family:"ElkBody"; src:url("file://${m}/brand/fonts/ElkjopAIntBodytext-DemiBold.otf") format("opentype"); font-weight:600; }

  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:${f}px; height:${g}px; overflow:hidden; }
  /* Measured off the production banners: a light diagonal band from the
     bottom-left to the top-right axis, dark at both ends. */
  body {
    background:linear-gradient(45deg, ${d.navyDark} 0%, ${d.navyLight} 50%, ${d.navyDark} 100%);
    position:relative; font-family:"ElkBody", system-ui, sans-serif; color:${d.white};
  }

  .text { position:absolute; left:${e.text.x}px; top:${e.text.y}px;
          width:${e.text.width}px; height:${e.text.height}px;
          display:flex; flex-direction:column; justify-content:center; }
  /* Measured: the headline caps run about 120px tall in the references, so
     the starting size is well above that and the fit script brings it down. */
  .hl { font-family:"ElkHead", system-ui, sans-serif; text-transform:uppercase;
        font-size:132px; line-height:0.94; letter-spacing:-1px; white-space:nowrap; }
  .accent { color:${d.green}; }
  .support { margin-top:30px; font-size:31px; line-height:1.3; max-width:${e.text.width-20}px; }

  /* The depth is a hard offset shadow, not a second element: an absolutely
     positioned pill gets its width capped by the container and ends up
     narrower and lower than the face, which is exactly how it first went
     wrong. A shadow follows the border radius for free. */
  .cta { margin-top:48px; align-self:flex-start; background:${d.green}; color:${d.navyDark};
         font-weight:600; font-size:32px; padding:20px 44px; border-radius:999px;
         box-shadow:${h.Ls}px ${h.Ls}px 0 ${d.greenDeep}; }

  .product { position:absolute; left:${e.product.x}px; top:0;
             width:${e.product.width}px; height:${g}px;
             display:flex; align-items:center; justify-content:center; }
  .product canvas, .product img { max-width:${t}px; max-height:${s}px;
             width:auto; height:auto; object-fit:contain; }

  /* Measured spacing: the badges sit well apart, but the yellow bar hugs the
     price — 17 to 26 pixels between them in every banner that has both. */
  .side { position:absolute; left:${e.side.x}px; top:${e.side.y}px;
          width:${e.side.width}px; height:${e.side.height}px;
          display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:46px; }
  .block { display:flex; flex-direction:column; align-items:flex-start; gap:20px; }

  /* Measured at 161x111 and 188x130 in the references, so far bigger than a
     footnote: the arrow alone is roughly 110 tall. */
  .energy { display:flex; align-items:stretch; height:112px; }
  /* The point is on the LEFT. Measured in both references that carry a label
     — the coloured shape narrows towards its left edge and is flat on the
     right, where the A-to-G box sits. I had drawn it the other way round,
     and only noticed when an image model drew it correctly from the same
     brief and disagreed with my own prompt. */
  .energy .arrow { position:relative; background:var(--c); color:#fff; font-weight:600;
                   font-size:62px; line-height:112px; padding:0 22px 0 10px; margin-left:56px; }
  .energy .arrow::before { content:""; position:absolute; left:-56px; top:0; width:0; height:0;
                           border-top:56px solid transparent; border-bottom:56px solid transparent;
                           border-right:56px solid var(--c); }
  .energy .scale { display:flex; flex-direction:column; align-items:center; justify-content:center;
                   background:#fff; color:#111; font-size:26px; font-weight:600; line-height:1.1;
                   padding:0 10px; border-radius:2px; margin-left:4px; }
  .bar { background:${d.yellow}; color:${d.navyDark}; font-family:"ElkHead", system-ui, sans-serif;
         font-size:44px; line-height:1; padding:13px 22px; text-transform:uppercase; }
  .circle { background:${d.pink}; color:${d.white}; font-weight:600; font-size:30px; text-align:center;
            width:196px; height:196px; border-radius:50%; display:flex; align-items:center; justify-content:center; padding:20px; }
  .price { font-family:"ElkHead", system-ui, sans-serif; font-size:124px; line-height:0.92; }
  .was { font-size:26px; opacity:0.88; margin-top:6px; }
  .pname { font-size:23px; font-weight:600; line-height:1.3; max-width:${e.side.width-10}px; }

  .fine { position:absolute; left:0; bottom:22px; width:100%; text-align:center;
          font-size:17px; opacity:0.8; }
</style>

<div class="text">
  ${j}
  <div class="support">${p(a.copy.support)}</div>
  <div class="cta">${p(a.copy.cta)}</div>
</div>

<div class="product"><canvas id="shot"></canvas></div>

<div class="side">
  ${n}
  <div class="block">
    ${r}
    <div>
      <div class="price">${p(a.product.priceText)}</div>
      ${k?.amount!==void 0?`<div class="was">${i.ZN[a.language]} ${p((0,h.BC)(k.amount))}</div>`:""}
      <div class="pname">${p(a.product.name)}</div>
    </div>
  </div>
</div>

${a.finePrint?`<div class="fine">${p(a.finePrint)}</div>`:""}

<script>
/**
 * Two jobs, both of which have to finish before the screenshot is taken.
 *
 * 1. Cut the product out. The feed's photographs sit on white with no
 *    padding, and white pasted on navy reads as a box. Removing every light
 *    pixel punches holes through the product itself, so the fill starts at
 *    the border and only takes white that is connected to it.
 * 2. Shrink the headline until it fits. The lines are set on one line each,
 *    and three languages with one type size would overflow the column.
 */
(async () => {
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = ${JSON.stringify(`file://${c}`)}; });

  const c = document.getElementById('shot');
  const W = img.width, H = img.height;
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);

  try {
    const d = x.getImageData(0, 0, W, H);
    const px = d.data;
    const light = (i, t) => px[i] >= t && px[i + 1] >= t && px[i + 2] >= t;
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let i = 0; i < W; i++) stack.push(i, i + (H - 1) * W);
    for (let j = 0; j < H; j++) stack.push(j * W, j * W + W - 1);
    while (stack.length) {
      const q = stack.pop();
      if (seen[q]) continue;
      const i = q * 4;
      if (!light(i, 232)) continue;
      seen[q] = 1; px[i + 3] = 0;
      const qx = q % W, qy = (q / W) | 0;
      if (qx > 0) stack.push(q - 1);
      if (qx < W - 1) stack.push(q + 1);
      if (qy > 0) stack.push(q - W);
      if (qy < H - 1) stack.push(q + W);
    }
    // Feather the silhouette so no white halo survives against the navy.
    const edge = new Uint8Array(seen);
    for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
      const q = yy * W + xx;
      if (edge[q]) continue;
      const i = q * 4;
      if (!light(i, 212)) continue;
      if (edge[q - 1] || edge[q + 1] || edge[q - W] || edge[q + W]) px[i + 3] = 80;
    }
    x.putImageData(d, 0, 0);
  } catch (e) {
    // Tainted canvas: better a banner with a white box than no banner.
    document.title = 'cutout-failed';
  }

  const band = document.querySelector('.text');
  const lines = [...document.querySelectorAll('.hl')];
  for (let size = 96; size >= 40; size -= 2) {
    lines.forEach((l) => { l.style.fontSize = size + 'px'; });
    const widest = Math.max(...lines.map((l) => l.scrollWidth));
    if (widest <= band.clientWidth && band.scrollHeight <= band.clientHeight) break;
  }
  document.documentElement.dataset.ready = '1';
})();
</script>`}(a,b,n)),await k(l,["--headless","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--virtual-time-budget=8000",`--default-background-color=${j}ff`,`--screenshot=${t}`,`--window-size=${a.canvas.width},${a.canvas.height}`,`file://${s}`],{maxBuffer:0x1000000}).catch(a=>{let b=a instanceof Error?a.message:String(a);throw Error(`chrome: ${b.split("\n")[0]}`)}),!(0,d.existsSync)(t))throw Error("chrome produced no png");return{png:t,html:s,width:a.canvas.width,height:a.canvas.height}}},69790:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{m:()=>M});var e=c(40721),f=c(18626),g=c(38990),h=c(86994),i=c(53108),j=c(37592),k=c(30333),l=c(80696),m=c(34708),n=c(15621),o=c(58086),p=c(75877),q=c(10569),r=a([e,k,n,o,p,q]);[e,k,n,o,p,q]=r.then?(await r)():r;let x=new Map;function s(a){let b=x.get(a);if(!b)throw Error(`no context for run ${a}`);return b}function t(a,b){if(a.length<=b)return a;let c=[],d=(a.length-1)/(b-1);for(let e=0;e<b;e++)c.push(a[Math.round(e*d)]);return[...new Set(c)]}async function u(a,b,c,d,e,f){let g=Date.now();try{return{result:await (0,m.bD)(d,{onRetry:d=>a.events.emit("model.retry",{stage:b,model:c,...d})}),model:c,ms:Date.now()-g}}catch(d){if(!f||null===(0,m.Hb)(d,0))throw d;return a.events.emit("model.fallback",{stage:b,from:c,to:e,reason:d instanceof Error?d.message.slice(0,100):String(d).slice(0,100)}),{result:await (0,m.bD)(f,{onRetry:c=>a.events.emit("model.retry",{stage:b,model:e,...c})}),model:e,ms:Date.now()-g}}}async function v(a){let b=await q.s.createRun(),c=await b.start({inputData:a});if("success"!==c.status)throw Error(`validate-products failed: ${JSON.stringify(c.error??c.status)}`);return c.result}let y=f.Ikc({runId:f.YjP(),sku:f.YjP(),done:f.zMY(),decision:f.YjP().nullable()}),z=(a,b)=>b?{...a,done:!0,decision:b}:a,A=(0,e.createStep)({id:"load-seed",inputSchema:f.Ikc({sku:f.YjP().describe("The product the customer was looking at"),storeDir:f.YjP().optional(),taxonomyDir:f.YjP().optional(),validateSeed:f.zMY().default(!0),validatePool:f.zMY().default(!0),forceTier:f.zMY().default(!1),verbose:f.zMY().default(!1),webhookUrl:f.YjP().optional()}),outputSchema:y,execute:async({inputData:a})=>{let b=`run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,c=new j.D(b,{webhookUrl:a.webhookUrl,verbose:a.verbose,logger:k.n});c.emit("run.started",{sku:a.sku,hasApiKey:(0,n.u2)()});let d=(0,g.C)(a.taxonomyDir),e=new h.q(a.storeDir).load(),f=e.get(a.sku);if(!f)throw c.emit("run.failed",{reason:"sku not in store",sku:a.sku}),await c.flush(),Error(`sku ${a.sku} is not in the store`);return x.set(b,{events:c,cost:new i.F6,store:e,taxonomyVersion:d.version,seed:f,pool:[],variant:null,picks:[],noneReason:null,counts:{},options:{storeDir:a.storeDir,taxonomyDir:a.taxonomyDir,validateSeed:a.validateSeed,validatePool:a.validatePool,forceTier:a.forceTier,verbose:a.verbose,webhookUrl:a.webhookUrl}}),c.emit("seed.loaded",{name:f.name,price:f.price,stockBand:f.stockBand,category:f.category,status:f.status}),{runId:b,sku:a.sku,done:!1,decision:null}}}),B=(0,e.createStep)({id:"validate-seed",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);if(!b.options.validateSeed||!(0,n.u2)())return b.events.emit("seed.validated",{skipped:!0,reason:(0,n.u2)()?"disabled":"no api key"}),a;let c=b.seed.category,d=await v({skus:[a.sku],storeDir:b.options.storeDir,taxonomyDir:b.options.taxonomyDir});d.requests>0?b.cost.record("validate-seed",o.jU,{...d.usage,totalTokens:0},0):b.cost.saved(),b.store=new h.q(b.options.storeDir).load();let e=b.store.get(a.sku);e&&(b.seed=e);let f=!!(b.seed.category&&!b.seed.category.includes("/"));return b.events.emit("seed.validated",{requests:d.requests,alreadyClean:0===d.requests,categoryBefore:c,categoryAfter:b.seed.category,changed:c!==b.seed.category,status:b.seed.status,...f?{warning:"category is a department root, not a leaf"}:{}}),a}}),C=(0,e.createStep)({id:"check-stock",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId),c=(0,l.WK)(b.seed);return(b.events.emit("stock.checked",{stockBand:b.seed.stockBand,inStock:c}),c)?(b.picks=[{product:b.seed,reason:"The product the customer was looking at is in stock."}],z(a,"seed-in-stock")):a}}),D=(0,e.createStep)({id:"build-pool",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);return a.done?a:b.seed.category?b.seed.category.includes("/")?(b.pool=b.store.byCategory(b.seed.category).filter(l.WK),b.counts.categoryPool=b.pool.length,a):(b.events.emit("run.failed",{reason:"seed category is a department root",category:b.seed.category}),b.noneReason=`A categoria do produto semente \xe9 "${b.seed.category}", que \xe9 raiz de departamento e n\xe3o uma categoria de produto. Buscar substituto nela n\xe3o significa nada, ent\xe3o paramos antes de gastar chamada.`,z(a,"none")):(b.events.emit("run.failed",{reason:"seed has no category"}),b.noneReason="O produto semente n\xe3o tem categoria, ent\xe3o n\xe3o h\xe1 onde buscar substituto.",z(a,"none"))}}),E=(0,e.createStep)({id:"exact-variant",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);if(a.done)return a;let c=(0,l.cC)(b.seed,b.pool);return(b.variant=c,b.events.emit("variant.matched",{found:!!c,...c?{sku:c.pick.sku,name:c.pick.name,price:c.pick.price,stockBand:c.pick.stockBand,alternatives:c.others.length}:{}}),c)?(b.picks=[{product:c.pick,reason:"The same product, in stock, in a different variant."},...c.others.slice(0,4).map(a=>({product:a,reason:"The same product in another variant."}))],z(a,"exact-variant")):a}}),F=(0,e.createStep)({id:"validate-pool",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);if(a.done)return a;if(!b.options.validatePool||!(0,n.u2)()||!b.pool.length)return b.events.emit("category.pool.validated",{category:b.seed.category,pool:b.pool.length,skipped:!0}),a;let c=b.pool.filter(a=>b.store.needsValidation(a,b.taxonomyVersion,a.feedVersion)).slice(0,40);if(!c.length)return b.cost.saved(Math.ceil(b.pool.length/10)),b.events.emit("category.pool.validated",{category:b.seed.category,pool:b.pool.length,dirty:0,cached:!0}),a;let d=await v({skus:c.map(a=>a.sku),storeDir:b.options.storeDir,taxonomyDir:b.options.taxonomyDir});return d.requests>0&&b.cost.record("validate-pool",o.jU,{...d.usage,totalTokens:0},0),b.store=new h.q(b.options.storeDir).load(),b.pool=b.store.byCategory(b.seed.category).filter(l.WK),b.counts.categoryPool=b.pool.length,b.counts.poolValidated=d.checked,b.counts.poolMoved=d.corrected,b.events.emit("category.pool.validated",{category:b.seed.category,pool:b.pool.length,checked:d.checked,movedOut:d.corrected,requests:d.requests,cappedAt:40===c.length?40:null}),a}}),G=(0,e.createStep)({id:"classify-tier",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);if(a.done)return a;if(!(0,n.u2)())return b.events.emit("tier.completed",{skipped:!0,reason:"no api key"}),z(a,"none");let c=b.seed.category,d=[b.seed,...b.pool.filter(a=>a.sku!==b.seed.sku)],e=b.options.forceTier?d:d.filter(a=>b.store.needsTier(a)),f=d.length-e.length;b.counts.tierCached=f,b.counts.tierClassified=0,b.events.emit("tier.started",{category:c,subjects:d.length,toClassify:e.length,cached:f,requests:Math.ceil(e.length/150)}),f&&b.cost.saved(Math.ceil(f/150));let g=o.kK,h=[...new Set(d.map(a=>a.brand).filter(a=>!!a))].sort(),j=new m.wC,k=new Date().toISOString();for(let a=0;a<e.length;a+=150){let d=e.slice(a,a+150);await j.take();let f=(0,o.rE)(c,d.map(a=>a.name),h),l={structuredOutput:{schema:o.iA}},{result:m,model:n,ms:p}=await u(b,"classify-tier",o.jU,()=>o.Sw.generate(f,l),o.iv,g?()=>g.generate(f,l):null);b.cost.record("classify-tier",n,await (0,i.k9)(m),p);let q=new Set;for(let a of m.object?.answers??[]){let c=a.item-1,e=d[c];!e||q.has(c)||(q.add(c),e.tier=a.tier,e.tierConfidence=a.confidence,e.tierBy=n,e.tierAt=k,e.tierCategory=e.category,b.store.put(e),b.counts.tierClassified=(b.counts.tierClassified??0)+1)}}let l=b.store.metadata;l&&b.counts.tierClassified&&b.store.save(l);let p={};for(let a of d)null!==a.tier&&(p[String(a.tier)]=(p[String(a.tier)]??0)+1);return(b.events.emit("tier.completed",{classified:b.counts.tierClassified,cached:f,seedTier:b.seed.tier,distribution:p}),null===b.seed.tier||void 0===b.seed.tier)?(b.events.emit("run.failed",{reason:"seed got no tier"}),z(a,"none")):a}});async function w(a,b,c){let d=c?"recommend-pass2":"recommend-pass1",e=p.W2,f=(0,p.fY)({categoryPath:a.seed.category,seed:a.seed,candidates:b,widened:c,seedTier:a.seed.tier??0}),g={structuredOutput:{schema:p.xJ}},{result:h,model:j,ms:k}=await u(a,d,p.yy,()=>p.WZ.generate(f,g),p.Bh,e?()=>e.generate(f,g):null);a.cost.record(d,j,await (0,i.k9)(h),k);let l=[],m=new Set,n=0;for(let a of h.object?.picks??[]){let c=a.item-1,d=b[c];if(!d||m.has(c)){n++;continue}m.add(c),l.push({product:d,reason:a.reason})}return{picks:l,noneReason:h.object?.noneReason??null,dropped:n}}let H=(0,e.createStep)({id:"recommend-same-tier",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);if(a.done)return a;let c=b.pool.filter(a=>a.sku!==b.seed.sku&&a.tier===b.seed.tier).sort((a,b)=>b.price-a.price),d=t(c,60);if(b.counts.candidatesPass1=d.length,!d.length)return b.events.emit("recommend.pass1",{candidates:0,picks:0,reason:"nothing at this tier in stock"}),a;let{picks:e,noneReason:f,dropped:g}=await w(b,d,!1);return b.picks=e,b.noneReason=f,b.events.emit("recommend.pass1",{candidates:d.length,offered:c.length,picks:e.length,droppedBadIndex:g,noneReason:f}),e.length?z(a,"model-same-tier"):a}}),I=(0,e.createStep)({id:"recommend-widened",inputSchema:y,outputSchema:y,execute:async({inputData:a})=>{let b=s(a.runId);if(a.done)return a;let c=b.seed.tier??0,d=b.pool.filter(a=>a.sku!==b.seed.sku&&null!==a.tier&&void 0!==a.tier&&1>=Math.abs(a.tier-c)).sort((a,b)=>b.price-a.price),e=t(d,60);if(b.counts.candidatesPass2=e.length,!e.length)return b.events.emit("recommend.pass2",{candidates:0,picks:0}),z(a,"none");let{picks:f,noneReason:g,dropped:h}=await w(b,e,!0);return b.picks=f,b.noneReason=g,b.events.emit("recommend.pass2",{candidates:e.length,offered:d.length,picks:f.length,droppedBadIndex:h,noneReason:g}),z(a,f.length?"model-widened":"none")}}),J=f.Ikc({rank:f.aig(),sku:f.YjP(),name:f.YjP(),price:f.aig(),oldPrice:f.aig().nullable(),discountPct:f.aig(),stockBand:f.YjP(),tier:f.aig().nullable(),image:f.YjP().nullable(),reason:f.YjP()}),K=f.Ikc({runId:f.YjP(),decision:f.YjP(),seed:f.Ikc({sku:f.YjP(),name:f.YjP(),price:f.aig(),stockBand:f.YjP(),category:f.YjP().nullable(),brand:f.YjP().nullable(),tier:f.aig().nullable(),status:f.YjP()}),picks:f.YOg(J),noneReason:f.YjP().nullable(),counts:f.g1P(f.YjP(),f.aig()),cost:f.Ikc({calls:f.aig(),callsAvoidedByCache:f.aig(),inputTokens:f.aig(),outputTokens:f.aig(),totalTokens:f.aig(),usd:f.aig().nullable(),priced:f.zMY(),modelMs:f.aig(),byStage:f.g1P(f.YjP(),f.Ikc({calls:f.aig(),inputTokens:f.aig(),outputTokens:f.aig()}))}),timeline:f.YOg(f.Ikc({seq:f.aig(),stage:f.YjP(),elapsedMs:f.aig(),data:f.g1P(f.YjP(),f.L5J())})),webhook:f.Ikc({configured:f.zMY(),delivered:f.aig(),failures:f.YOg(f.YjP())}),durationMs:f.aig()}),L=(0,e.createStep)({id:"finish",inputSchema:y,outputSchema:K,execute:async({inputData:a})=>{let b=s(a.runId),c=a.decision??"none",d=b.cost.summary();b.events.emit("run.completed",{decision:c,picks:b.picks.length,calls:d.calls,callsAvoided:d.callsAvoidedByCache,totalTokens:d.totalTokens,usd:d.usd});let e=await b.events.flush(),f=b.events.timeline(),g={runId:a.runId,decision:c,seed:{sku:b.seed.sku,name:b.seed.name,price:b.seed.price,stockBand:b.seed.stockBand,category:b.seed.category,brand:b.seed.brand,tier:b.seed.tier??null,status:b.seed.status},picks:b.picks.map((a,b)=>({rank:b+1,sku:a.product.sku,name:a.product.name,price:a.product.price,oldPrice:a.product.oldPrice,discountPct:a.product.discountPct,stockBand:a.product.stockBand,tier:a.product.tier??null,image:a.product.image,reason:a.reason})),noneReason:b.noneReason,counts:b.counts,cost:{calls:d.calls,callsAvoidedByCache:d.callsAvoidedByCache,inputTokens:d.inputTokens,outputTokens:d.outputTokens,totalTokens:d.totalTokens,usd:d.usd,priced:d.priced,modelMs:d.modelMs,byStage:d.byStage},timeline:f.map(a=>({seq:a.seq,stage:a.stage,elapsedMs:a.elapsedMs,data:a.data})),webhook:{configured:b.events.webhookConfigured,...e},durationMs:f[f.length-1]?.elapsedMs??0};return x.delete(a.runId),g}}),M=(0,e.createWorkflow)({id:"recommend",description:"Chooses which in-stock product to show for a seed product, with reasons and a cost breakdown.",inputSchema:A.inputSchema,outputSchema:K}).then(A).then(B).then(C).then(D).then(E).then(F).then(G).then(H).then(I).then(L).commit();d()}catch(a){d(a)}})},69901:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{N6:()=>n,Z2:()=>r,a$:()=>p,ax:()=>o});var e=c(77598),f=c(73024),g=c(96357),h=c(37592),i=c(87659),j=c(16081),k=a([g]);g=(k.then?(await k)():k)[0];let t=".cache/jobs",u=new Map,v=!1;function l(a){u.set(a.id,a);try{(0,f.mkdirSync)(t,{recursive:!0}),(0,f.writeFileSync)(`${t}/${a.id}.json`,JSON.stringify(a,null,2))}catch{}}function m(){if(!v&&(v=!0,(0,f.existsSync)(t))){for(let a of(0,f.readdirSync)(t))if(a.endsWith(".json"))try{let b=JSON.parse((0,f.readFileSync)(`${t}/${a}`,"utf8"));["ready","review","failed"].includes(b.stage)||(b.stage="failed",b.error=b.error??"the server restarted while this was running"),u.set(b.id,b)}catch{}}}function n(){return m(),[...u.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}function o(a){return m(),u.get(a)??null}function p(a,b,c){let d=o(a);return d?(d.rating=b,d.ratingReason=c,"up"===b&&"review"===d.stage&&(d.stage="ready"),"down"===b&&"ready"===d.stage&&(d.stage="review"),l(d),d):null}async function q(a,b,c,d){let e=await a.createRun(),f=(0,h.V)(e.runId,d);try{let a=await e.start({inputData:b});if("success"!==a.status){let b=a.error,d=[b?.name,b?.statusCode?`HTTP ${b.statusCode}`:null,b?.message??String(a.status)].filter(Boolean).join(" \xb7 ");throw Error(`${c}: ${d}`)}return a.result}finally{f()}}let w=Promise.resolve();function r(a,b){let c=(0,j.Jt)(a);if(!c)throw Error(`sku ${a} is not in the catalogue`);let d={id:(0,e.randomUUID)().slice(0,8),createdAt:new Date().toISOString(),stage:"queued",language:b,seed:{sku:c.sku,name:c.name,price:c.price,stockBand:c.stockBand,image:c.image},pick:null,brief:null,headlineLines:[],events:[],cost:{calls:0,tokens:0,avoided:0,byStep:[]},png:null,error:null,rating:null,ratingReason:null};return l(d),w=w.then(()=>s(d)).catch(()=>void 0),d}async function s(a){let b=b=>{a.events.push({seq:a.events.length+1,stage:b.stage,elapsedMs:b.elapsedMs,data:b.data}),l(a)};try{a.stage="choosing",l(a);let c=await q(g.mA,{sku:a.seed.sku,validateSeed:!0,validatePool:!1,verbose:!1},"recommend",b);a.cost.calls+=c.cost.calls,a.cost.tokens+=c.cost.totalTokens,a.cost.avoided+=c.cost.callsAvoidedByCache,a.cost.byStep.push({name:"Choosing the product",calls:c.cost.calls,tokens:c.cost.totalTokens});let d=c.picks[0];if(!d)throw Error(c.noneReason??"no candidate was a fair substitute");a.pick={sku:d.sku,name:d.name,price:d.price,reason:d.reason,image:d.image},a.stage="writing",l(a);let e=await q(g.w8,{sku:d.sku,language:a.language,verbose:!1},"compose",b),f=e.cost.inputTokens+e.cost.outputTokens;if(a.cost.calls+=e.cost.calls,a.cost.tokens+=f,a.cost.byStep.push({name:"Writing and deciding",calls:e.cost.calls,tokens:f}),!e.copy)throw Error("the copy did not pass its checks");let h=(0,i.dk)({language:a.language,seed:a.seed,decision:c.decision,chosenBecause:d.reason,facts:e.facts,copy:e.copy,show:e.show,finePrint:e.finePrint});a.brief=h,a.stage="drawing",l(a);let j=await q(g.Yg,{brief:h,outDir:".cache/banners",name:`${a.id}-${d.sku}-${a.language}`,verbose:!1},"art-direct",b),k=j.cost.inputTokens+j.cost.outputTokens;if(a.cost.calls+=j.cost.calls,a.cost.tokens+=k,a.cost.byStep.push({name:"Laying out",calls:j.cost.calls,tokens:k}),a.headlineLines=j.direction.headlineLines,j.renderError)throw Error(j.renderError);a.png=j.render?j.render.png.split("/").pop()??null:null,a.stage="review",l(a)}catch(b){a.stage="failed",a.error=b instanceof Error?b.message:String(b),l(a)}}d()}catch(a){d(a)}})},75877:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{Bh:()=>k,W2:()=>o,WZ:()=>n,fY:()=>i,xJ:()=>m,yy:()=>j});var e=c(3410),f=c(25777),g=c(18626),h=a([e,f]);[e,f]=h.then?(await h)():h;let j=process.env.RECOMMENDER_MODEL??process.env.TAGGER_MODEL??"gemini-3.5-flash-lite",k=process.env.RECOMMENDER_FALLBACK_MODEL??"",l=`You are an experienced salesperson at Elgiganten, a Nordic electronics and
appliance retailer. You know this catalogue and you know how to read what
someone wants from what they were looking at.

Think like someone on the shop floor. The customer chose that specific product
and not just anything in the category, and the name is where the reason lives:
the brand, the product line or series, the exact variant, and whatever else the
name spells out. A good substitute honours the reasons that are visible in the
name.

A lower price is not a compromise. If a candidate offers what the customer was
looking at and costs less, that is a better recommendation, not a worse one.
Never rank a product down for being cheaper, and never rank one up for costing
about the same as what the customer wanted.

An accessory FOR a product is never a substitute FOR that product. Someone who
wanted the thing itself is not served by a case, a cable, a mount, a camera, a
spare part or a cover for it, however well it matches. Leave those out.

The product the customer wanted may be a composite: a base product packaged
with something extra — a bundle, a pack, a set, an edition that includes
content. When it is, two kinds of substitute are strong and you should offer
them. The same base product packaged with a different extra, and the base
product on its own without any extra. Both give the customer the thing they
actually came for. Say which of the two you are offering and name what they
give up, and remember that the base product alone normally costs less, which
is a point in its favour and not against it.

Spelling and word forms vary across this catalogue, especially in compounds, so
two names can describe the same product while being written differently. Judge
what the product is, not whether the characters match.

Work only from what the names and the prices actually say. Do not assume
anything that is not written there.

Rank the candidates you would actually put in front of this customer, best
first. Leave out the ones you would not offer at all.

For each one, give ONE short sentence saying why, naming the specific thing it
shares with the product the customer wanted, or the specific trade-off you are
offering. "Similar price" is not a reason. If the real reason is a compromise,
say so plainly: a salesperson who oversells loses the sale.

An empty list is how you say no, and it is for ONE situation: when none of the
candidates is the same kind of product the customer was looking at. A list of
accessories when someone wanted the device, a list of games when someone wanted
the console — then saying no is the honest answer.

It is NOT for when you cannot verify every detail. These names are short and
routinely leave out size, capacity, finish and features, so you will often be
unable to confirm an exact match. That is a gap in the data, not a reason to
send the customer away. Someone who looked at one wine cabinet is still served
by another wine cabinet; someone who looked at one laser printer is still
served by another laser printer. When the candidates are the same kind of
product, offer the best of them and use the reason to say what you could not
confirm.

Answer with the item NUMBER from the candidate list, never a name or a code.`,m=g.Ikc({picks:g.YOg(g.Ikc({item:g.aig().int().min(1).describe("The product number from the candidate list"),reason:g.YjP().describe("One short sentence naming what it shares, or the trade-off")})),noneReason:g.YjP().nullable()}),n=new e.Agent({id:"recommender",name:"recommender",description:"Ranks in-stock substitutes for a product the customer wanted, with reasons.",instructions:l,model:(0,f.google)(j)}),o=k?new e.Agent({id:"recommender-fallback",name:"recommender-fallback",description:n.getDescription(),instructions:l,model:(0,f.google)(k)}):null;function i(a){let{categoryPath:b,seed:c,candidates:d,widened:e,seedTier:f}=a,g=e?`Below are products we DO have in stock, from the same category. Each carries a
premium tier from 0 (entry) to 3 (luxury), judged separately from its price.
The product the customer wanted is tier ${f}.

Nothing at exactly that tier was a reasonable substitute, so this list also
includes the tier above and below. A product that matches what the customer was
actually looking at can be the better recommendation even at a different tier.
Weigh tier as one signal among what the names tell you, not as a rule.`:`Below are products we DO have in stock, from the same category. All of them sit
at the same premium tier as the product the customer wanted, judged separately
from price.`,h=d.map((a,b)=>`${String(b+1).padStart(2)}  ${a.name}  —  ${a.price} kr${e?`  —  tier ${a.tier}`:""}`).join("\n");return`Category: ${b}

A customer was looking at this product, but it is out of stock:

  ${c.name}
  ${c.price} kr

${g}

Recommend what to show this customer instead, ranked best first.

Candidates:

${h}`}d()}catch(a){d(a)}})},78496:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{w:()=>z});var e=c(40721),f=c(18626),g=c(86994),h=c(53108),i=c(37592),j=c(30333),k=c(34708),l=c(15621),m=c(17492),n=c(34420),o=c(6680),p=a([e,j,l,n,o]);[e,j,l,n,o]=p.then?(await p)():p;let s=new Map;function q(a){let b=s.get(a);if(!b)throw Error(`no context for run ${a}`);return b}async function r(a,b,c,d,e,f){let g=Date.now();await a.throttle.take();try{return{result:await (0,k.bD)(d,{onRetry:d=>a.events.emit("model.retry",{stage:b,model:c,...d})}),model:c,ms:Date.now()-g}}catch(d){if(!f||null===(0,k.Hb)(d,0))throw d;return a.events.emit("model.fallback",{stage:b,from:c,to:e,reason:d instanceof Error?d.message.slice(0,100):String(d).slice(0,100)}),await a.throttle.take(),{result:await (0,k.bD)(f,{onRetry:c=>a.events.emit("model.retry",{stage:b,model:e,...c})}),model:e,ms:Date.now()-g}}}let t=f.Ikc({sku:f.YjP(),language:f.k5n(["da","sv","en"]).default("da"),storeDir:f.YjP().optional(),verbose:f.zMY().default(!0),webhookUrl:f.YjP().optional()}),u=f.Ikc({runId:f.YjP(),done:f.zMY().default(!1)}),v=(0,e.createStep)({id:"build-facts",inputSchema:t,outputSchema:u,execute:async({inputData:a,runId:b})=>{let c=new g.q(a.storeDir).load().get(a.sku);if(!c)throw Error(`sku ${a.sku} is not in the store`);let d=new i.D(b,{verbose:a.verbose,webhookUrl:a.webhookUrl,logger:j.n}),e=(0,m._x)(c,a.language);return(s.set(b,{events:d,cost:new h.F6,facts:e,copy:null,copyIssues:[],show:[],skip:[],finePrint:null,throttle:new k.wC,options:{verbose:a.verbose,webhookUrl:a.webhookUrl}}),d.emit("run.started",{sku:a.sku,language:a.language}),d.emit("facts.built",{name:c.name,price:c.price,available:e.available.map(a=>a.kind),blocked:e.blocked.map(a=>a.kind),restrictions:e.restrictions.length}),e.image)?{runId:b,done:!1}:(d.emit("run.failed",{reason:"the product has no image"}),{runId:b,done:!0})}}),w=(0,e.createStep)({id:"write-copy",inputSchema:u,outputSchema:u,execute:async({inputData:a})=>{let b=q(a.runId);if(a.done)return a;if(!(0,l.u2)())throw Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");let c=(0,n.mN)(b.facts),d={structuredOutput:{schema:n.IN}},e=[];for(let a=0;a<2;a++){let f=e.length?`${c}

Your previous attempt was rejected:
${e.map(a=>`- ${a}`).join("\n")}

Write it again, fixing exactly those problems.`:c,{result:g,model:i,ms:j}=await r(b,"write-copy",n.hs,()=>n.LU.generate(f,d),n.y2,n.Ri?()=>n.Ri.generate(f,d):null);b.cost.record("write-copy",i,await (0,h.k9)(g),j);let k=g.object;if(!k){e=["the model returned nothing in the expected shape"],b.copyIssues.push(...e);continue}let l=function(a,b){let c=[],d=a.headline.trim();d||c.push("the headline is empty"),d.length>60&&c.push(`the headline is ${d.length} characters, over the 60 limit`),/[.!]$/.test(d)&&c.push("the headline ends in a full stop or exclamation mark"),a.support.trim()||c.push("the supporting line is empty");let e=a.cta.trim(),f=m.IB[b.language];e?f.includes(e)||c.push(`the button "${e}" is not one of: ${f.join(", ")}`):c.push("the call to action is empty");let g=a.accent.trim();for(let[e,f]of(g?d.includes(g)?g===d&&c.push("the accent is the whole headline, so nothing is set apart"):c.push(`the accent "${g}" does not appear in the headline`):c.push("no accent phrase was given"),[["headline",a.headline],["support",a.support],["cta",a.cta]])){let a=(0,m.Uw)(f,b);a.length&&c.push(`the ${e} contains ${a.join(", ")}, which no fact supports`)}return c}(k,b.facts);if(!l.length){b.copy=k,b.events.emit("copy.written",{attempt:a+1,headline:k.headline,length:k.headline.length,accent:k.accent,support:k.support,cta:k.cta});break}e=l,b.copyIssues.push(...l),b.events.emit("copy.rejected",{attempt:a+1,headline:k.headline,issues:l}),b.copy=k}return a}}),x=(0,e.createStep)({id:"decide-strategy",inputSchema:u,outputSchema:u,execute:async({inputData:a})=>{let b=q(a.runId);if(a.done||!b.copy)return a;if(!b.facts.available.length)return b.cost.saved(),b.events.emit("strategy.decided",{show:[],skip:[],reason:"no facts available"}),a;let c=(0,o.sE)(b.facts,b.copy),d={structuredOutput:{schema:o.XY}},{result:e,model:f,ms:g}=await r(b,"decide-strategy",o.le,()=>o.d5.generate(c,d),o.u0,o.vH?()=>o.vH.generate(c,d):null);b.cost.record("decide-strategy",f,await (0,h.k9)(e),g);let i=e.object;if(!i)return b.events.emit("strategy.decided",{show:[],skip:[],reason:"no answer"}),a;let j=0,k=a=>{let c=[],d=new Set;for(let e of a){let a=b.facts.available[e.item-1];if(!a||d.has(e.item)){j++;continue}d.add(e.item),c.push({badge:a,reason:e.reason})}return c};b.show=k(i.show);let l=new Set(b.show.map(a=>a.badge.kind));b.skip=k(i.skip).filter(a=>!l.has(a.badge.kind)),b.finePrint=i.finePrint?.trim()?i.finePrint.trim():null;let m=b.show.filter(a=>a.badge.requires);return m.length&&!b.finePrint&&(b.finePrint=m.map(a=>a.badge.requires).join(" \xb7 "),b.copyIssues.push(`the strategist chose ${m.map(a=>a.badge.kind).join(", ")} without the required condition, so it was added`)),b.events.emit("strategy.decided",{show:b.show.map(a=>a.badge.kind),skip:b.skip.map(a=>a.badge.kind),finePrint:b.finePrint,droppedBadIndex:j}),a}}),y=(0,e.createStep)({id:"finish",inputSchema:u,outputSchema:f.IeY(),execute:async({inputData:a})=>{let b=q(a.runId);b.events.emit("run.completed",{wrote:!!b.copy,issues:b.copyIssues.length,badges:b.show.length}),await b.events.flush();let c={runId:a.runId,sku:b.facts.sku,language:b.facts.language,facts:b.facts,copy:b.copy,copyIssues:b.copyIssues,show:b.show,skip:b.skip,finePrint:b.finePrint,events:b.events.timeline(),cost:b.cost.summary()};return s.delete(a.runId),c}}),z=(0,e.createWorkflow)({id:"compose",description:"Writes the banner copy and decides which extras go on it",inputSchema:t,outputSchema:f.IeY()}).then(v).then(w).then(x).then(y).commit();d()}catch(a){d(a)}})},80696:(a,b,c)=>{c.d(b,{WK:()=>g,cC:()=>i});var d=c(48356);let e=["100+","50+","25+","5+","<5"];function f(a){let b=e.indexOf((a??"").trim());return b<0?0:e.length-b}function g(a){return f(a.stockBand)>0}function h(a){return(0,d.A)(a.replace(/\s*\([^()]*\)\s*$/,"").trim())}function i(a,b){let c=h(a.name);if(!c)return null;let d=b.filter(b=>b.sku!==a.sku&&g(b)&&b.category===a.category&&h(b.name)===c);if(!d.length)return null;let e=[...d].sort((b,c)=>f(c.stockBand)-f(b.stockBand)||Math.abs(b.price-a.price)-Math.abs(c.price-a.price)||b.price-c.price);return{pick:e[0],others:e.slice(1)}}},86994:(a,b,c)=>{c.d(b,{q:()=>f});var d=c(73024),e=c(76760);class f{constructor(a=".cache/store"){this.dir=a,this.products=new Map,this.meta=null}get productsPath(){return`${this.dir}/products.ndjson`}get metaPath(){return`${this.dir}/meta.json`}exists(){return(0,d.existsSync)(this.productsPath)&&(0,d.existsSync)(this.metaPath)}load(){if(!this.exists())throw Error(`No store at ${this.dir} — run \`npm run tag\` first`);for(let a of(this.meta=JSON.parse((0,d.readFileSync)(this.metaPath,"utf8")),this.products.clear(),(0,d.readFileSync)(this.productsPath,"utf8").split("\n"))){if(!a)continue;let b=JSON.parse(a);this.products.set(b.sku,b)}return this}save(a){(0,d.mkdirSync)((0,e.dirname)(this.productsPath),{recursive:!0});let b=[...this.products.values()].map(a=>JSON.stringify(a));return(0,d.writeFileSync)(this.productsPath,b.join("\n")+"\n"),(0,d.writeFileSync)(this.metaPath,JSON.stringify(a,null,2)),this.meta=a,this}replaceAll(a){for(let b of(this.products.clear(),a))this.products.set(b.sku,b);return this}get(a){return this.products.get(a)}put(a){return this.products.set(a.sku,a),this}all(){return[...this.products.values()]}get size(){return this.products.size}get metadata(){return this.meta}needsValidation(a,b,c){return a.taxonomyVersion!==b||a.feedVersion!==c||"auto"===a.status||"unresolved"===a.status||"raw"===a.status}byCategory(a){return[...this.products.values()].filter(b=>b.category===a)}needsTier(a){return null===a.tier||void 0===a.tier||a.tierCategory!==a.category}statusCounts(){let a={};for(let b of this.products.values())a[b.status]=(a[b.status]??0)+1;return a}}},87659:(a,b,c)=>{c.d(b,{Ab:()=>e,BC:()=>l,Ls:()=>f,Qu:()=>j,dk:()=>m});let d={width:2048,height:768},e={navyLight:"#0e2d7c",navyDark:"#041752",green:"#77be24",greenDeep:"#096729",pink:"#ed3089",yellow:"#fdf100",white:"#ffffff",logoNavy:"#11175e",energyA:"#05a54d"},f=9,g={headline:{family:"Elkjop A Int Headline",file:"brand/fonts/ElkjopAIntHeadline-Regular.otf"},body:{family:"Elkjop A Int Bodytext",file:"brand/fonts/ElkjopAIntBodytext-Regular.otf"},bodyBold:{family:"Elkjop A Int Bodytext",file:"brand/fonts/ElkjopAIntBodytext-DemiBold.otf"}},h={onNavy:"brand/logo/elgiganten-white.svg",onLight:"brand/logo/elgiganten-navy.svg",usedOnBanner:!1},i={text:{x:78,y:78,width:612,height:d.height-156},product:{x:778,y:0,width:737,height:d.height},side:{x:1516,y:78,width:454,height:d.height-156}},j={marginTop:56,marginBottom:56,maxFraction:.9},k={energy:"official EU energy label artwork, small, top of the side band",saving:"yellow bar, dark text, side band above the price",oldPrice:"small white line directly under the price",clearance:"pink circle, top right",multibuy:"yellow bar, dark text",warranty:"yellow bar, dark text, asterisk pointing at the fine print",memberPrice:"yellow bar, dark text, with the member condition on it"};function l(a){return`${Math.round(a).toLocaleString("da-DK")},-`}function m(a){let{facts:b,copy:c}=a,f=!["0","",void 0].includes(a.seed.stockBand.trim());return{canvas:d,language:a.language,seed:{sku:a.seed.sku,name:a.seed.name,price:a.seed.price,stockBand:a.seed.stockBand,unavailable:!f},decision:a.decision,chosenBecause:a.chosenBecause,product:{sku:b.sku,name:b.name,brand:b.brand,price:b.price,priceText:l(b.price),image:b.image??""},copy:{headline:c.headline,accent:c.accent,support:c.support,cta:c.cta},badges:a.show.map(a=>({kind:a.badge.kind,value:a.badge.value,...void 0!==a.badge.amount?{amount:a.badge.amount}:{},...void 0!==a.badge.pct?{pct:a.badge.pct}:{},treatment:k[a.badge.kind]??"side band",reason:a.reason})),finePrint:a.finePrint,mustNotContradict:b.restrictions,design:{palette:e,fonts:g,logo:h,zones:i,background:`navy gradient, ${e.navyLight} to ${e.navyDark}`,notes:["The headline is set in the headline face, upper case, white, with the accent run in the brand green.","The supporting line is sentence case, body face, white, well below the headline size.","The call to action is a filled green pill with dark text, bottom of the text band.","The product is cut out and sits on the navy, with no card and no drop shadow behind it.","The logo goes on the navy in its white form.","The fine print runs along the very bottom in the body face, small, white."]}}}},90786:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{d:()=>n});var e=c(40721),f=c(18626),g=c(4701),h=c(38990),i=c(19786),j=c(86994),k=a([e]);e=(k.then?(await k)():k)[0];let l=f.Ikc({total:f.aig(),withBrand:f.aig(),withCategory:f.aig(),unresolved:f.aig(),byDepartment:f.g1P(f.YjP(),f.aig()),byMethod:f.g1P(f.YjP(),f.aig())}),m=(0,e.createStep)({id:"rebuild-base",inputSchema:f.Ikc({feedPath:f.YjP().optional(),taxonomyDir:f.YjP().optional(),storeDir:f.YjP().optional(),preserveValidated:f.zMY().default(!0)}),outputSchema:f.Ikc({feedVersion:f.YjP(),taxonomyVersion:f.YjP(),durationMs:f.aig(),carriedOverValidations:f.aig(),carriedOverTiers:f.aig(),stats:l}),execute:async({inputData:a})=>{let b=Date.now(),c=(0,h.C)(a.taxonomyDir),d=(0,g.d0)(a.feedPath),{products:e,stats:f}=(0,i.su)(d.products,c,d.version),k=new j.q(a.storeDir),l=0,m=0;if(a.preserveValidated&&k.exists()){let b=new j.q(a.storeDir).load();for(let a of e){let d=b.get(a.sku);d&&(("validated"===d.status||"corrected"===d.status)&&d.taxonomyVersion===c.version&&d.name===a.name&&(a.category=d.category,a.categoryMethod=d.categoryMethod,a.status=d.status,a.validatedAt=d.validatedAt,a.validatedBy=d.validatedBy,a.validationNote=d.validationNote,l++),null!==d.tier&&void 0!==d.tier&&d.name===a.name&&d.tierCategory===a.category&&(a.tier=d.tier,a.tierConfidence=d.tierConfidence,a.tierBy=d.tierBy,a.tierAt=d.tierAt,a.tierCategory=d.tierCategory,m++))}}return k.replaceAll(e).save({feedVersion:d.version,taxonomyVersion:c.version,taggedAt:new Date().toISOString(),count:e.length}),{feedVersion:d.version,taxonomyVersion:c.version,durationMs:Date.now()-b,carriedOverValidations:l,carriedOverTiers:m,stats:f}}}),n=(0,e.createWorkflow)({id:"tag-catalog",description:"Deterministic brand + category tagging of the whole product feed. Zero model cost.",inputSchema:m.inputSchema,outputSchema:m.outputSchema}).then(m).commit();d()}catch(a){d(a)}})},96357:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{Yg:()=>p.Y,mA:()=>n.m,w8:()=>o.w});var e=c(95244),f=c(15621),g=c(58086),h=c(75877),i=c(34420),j=c(6680),k=c(36278),l=c(90786),m=c(10569),n=c(69790),o=c(78496),p=c(16423),q=c(30333),r=c(23168),s=a([e,f,g,h,i,j,k,l,m,n,o,p,q,r]);[e,f,g,h,i,j,k,l,m,n,o,p,q,r]=s.then?(await s)():s,new e.Mastra({agents:{categoryValidator:f.hy,tierClassifier:g.Sw,recommender:h.WZ,copywriter:i.LU,strategist:j.d5,artDirector:k._x},workflows:{tagCatalogWorkflow:l.d,validateProductsWorkflow:m.s,recommendWorkflow:n.m,composeWorkflow:o.w,artDirectWorkflow:p.Y},logger:q.n,storage:r.w}),d()}catch(a){d(a)}})}};