/**
 * Turns a brief plus the art direction into an actual 2048×768 banner.
 *
 * Deterministic on purpose. Every value the customer can read — the price, the
 * saving, the product name, the copy — is written here from the brief, so no
 * model stands between the feed and the pixels. The model decided where the
 * headline breaks and how big the product sits; everything else is measured
 * brand data from `brand/` and from the production banners.
 *
 * Rendering goes through headless Chrome, which is already on this machine.
 * That buys real text shaping with the brand's own OTF fonts, which is the
 * part a hand-rolled SVG would get wrong.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { CTA_DEPTH, MARGIN, PALETTE, PRODUCT_BOX, priceText, type ArtDirectorBrief, type BriefBadge } from './brief.js';
import { BEFORE_WORD, SAVE_WORD, type Language } from './facts.js';

/** Chrome wants the colour without the leading hash. */
const PALETTE_NAVY_DARK = PALETTE.navyDark.replace('#', '');
import type { ArtDirection } from '../mastra/agents/art-director.js';

const run = promisify(execFile);

export const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/**
 * Repo root, so the HTML can point at brand/fonts with absolute file URLs.
 *
 * Taken from the working directory rather than from `import.meta.url`: a
 * bundler rewrites `new URL(..., import.meta.url)` into an asset reference
 * and then fails to resolve `'../..'` as a module, which broke the Next
 * build. Both entry points — the CLIs and the web server — run from the
 * repository root, and `BANNER_ROOT` covers anything that does not.
 */
const ROOT = resolve(process.env.BANNER_ROOT ?? process.cwd());

/** Official EU energy label colours, A at the top of the scale down to G. */
const ENERGY_COLORS: Record<string, string> = {
  A: '#00a650', B: '#4cb847', C: '#bfd630', D: '#fff200',
  E: '#fdb913', F: '#f37021', G: '#ed1c24',
};

/**
 * How much of the room inside the safe area the product takes.
 *
 * Anchored to the measurements: the biggest product in the references fills
 * 90% of the canvas height and the smallest grouping 68%, so `fill` is the
 * top of the measured range rather than the edge of the canvas. Nothing here
 * can reach 1.0, which is what stops a product being cropped.
 */
const SCALE: Record<ArtDirection['productScale'], number> = {
  fill: 1.0, large: 0.92, medium: 0.78, small: 0.6,
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Wraps the accent run in a span, matching on words so that a stray space does
 * not stop the highlight from appearing. Falls back to the plain line.
 */
function markAccent(line: string, accent: string): string {
  const a = accent.trim();
  if (!a) return esc(line);
  /**
   * Case-insensitive, because the art director returns the headline already
   * shouted while the copywriter wrote the accent in sentence case. Matching
   * exactly silently dropped the green from an otherwise correct banner.
   */
  const at = line.toLowerCase().indexOf(a.toLowerCase());
  if (at === -1) return esc(line);
  return (
    esc(line.slice(0, at)) +
    `<span class="accent">${esc(line.slice(at, at + a.length))}</span>` +
    esc(line.slice(at + a.length))
  );
}

function energyBadge(cls: string): string {
  const letter = cls.trim().charAt(0).toUpperCase();
  const color = ENERGY_COLORS[letter] ?? '#00a650';
  // The arrow and the A–G scale beside it, as the label appears in the
  // reference banners. The feed also ships official artwork in
  // EnergyArrowUrlSvg, which is what production should use instead of this.
  return `<div class="energy">
    <div class="arrow" style="--c:${color}">${esc(cls)}</div>
    <div class="scale"><span>A</span><span class="arrowhead">↑</span><span>G</span></div>
  </div>`;
}

/**
 * The badge as the brand writes it, not as the facts store it.
 *
 * The savings badge in the references reads "MOBILRABAT 1800", never
 * "1800 kr (24%)". The figure arrives as a number precisely so it can be set
 * in the local price style here instead of being pasted through.
 */
function badgeHtml(b: BriefBadge, language: Language): string {
  if (b.kind === 'energy') return energyBadge(b.value);
  if (b.kind === 'oldPrice') return '';
  if (b.kind === 'clearance') return `<div class="circle">${esc(b.value)}</div>`;
  if (b.kind === 'saving' && b.amount !== undefined) {
    return `<div class="bar">${SAVE_WORD[language]} ${esc(priceText(b.amount))}</div>`;
  }
  if (b.kind === 'memberPrice' && b.amount !== undefined) {
    return `<div class="bar">${esc(b.value.replace(/^[0-9.,]+ kr/, priceText(b.amount)))}</div>`;
  }
  return `<div class="bar">${esc(b.value)}</div>`;
}

export interface RenderOptions {
  /** Where the .html, the product cut-out and the .png are written. */
  outDir: string;
  /** Base name, without extension. */
  name: string;
  /** Keep the intermediate HTML next to the PNG. Default true, it is tiny. */
  keepHtml?: boolean;
}

export interface RenderResult {
  png: string;
  html: string;
  width: number;
  height: number;
}

export function bannerHtml(
  brief: ArtDirectorBrief,
  direction: ArtDirection,
  productFile: string,
): string {
  const p = brief.design.palette;
  const z = brief.design.zones;
  const { width, height } = brief.canvas;

  const headline = direction.headlineLines
    .map((l) => `<div class="hl">${markAccent(l, brief.copy.accent)}</div>`)
    .join('');

  const oldPrice = brief.badges.find((b) => b.kind === 'oldPrice');
  /**
   * The yellow bars sit 17 to 26 pixels above the price in every reference
   * that has both, while the energy label stands well clear of them. So the
   * bars travel with the price in one block and the rest sit on their own.
   */
  const isTight = (b: BriefBadge) => b.kind !== 'energy' && b.kind !== 'clearance';
  const looseBadges = brief.badges
    .filter((b) => !isTight(b))
    .map((b) => badgeHtml(b, brief.language))
    .join('');
  const tightBadges = brief.badges
    .filter(isTight)
    .map((b) => badgeHtml(b, brief.language))
    .join('');

  /**
   * The product's box, in pixels, worked out before any CSS runs.
   *
   * `maxFraction` of the canvas is the biggest the references ever go, and the
   * margins are the smallest air they ever leave. Taking the lower of the two
   * means the product is always whole and always has room around it, whatever
   * scale the art director asked for.
   */
  const roomH = Math.min(
    Math.round(height * PRODUCT_BOX.maxFraction),
    height - PRODUCT_BOX.marginTop - PRODUCT_BOX.marginBottom,
  );
  const productH = Math.round(roomH * SCALE[direction.productScale]);
  const productW = Math.round(z.product.width * SCALE[direction.productScale]);

  return `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family:"ElkHead"; src:url("file://${ROOT}/brand/fonts/ElkjopAIntHeadline-Regular.otf") format("opentype"); }
  @font-face { font-family:"ElkBody"; src:url("file://${ROOT}/brand/fonts/ElkjopAIntBodytext-Regular.otf") format("opentype"); font-weight:400; }
  @font-face { font-family:"ElkBody"; src:url("file://${ROOT}/brand/fonts/ElkjopAIntBodytext-DemiBold.otf") format("opentype"); font-weight:600; }

  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:${width}px; height:${height}px; overflow:hidden; }
  /* Measured off the production banners: a light diagonal band from the
     bottom-left to the top-right axis, dark at both ends. */
  body {
    background:linear-gradient(45deg, ${p.navyDark} 0%, ${p.navyLight} 50%, ${p.navyDark} 100%);
    position:relative; font-family:"ElkBody", system-ui, sans-serif; color:${p.white};
  }

  .text { position:absolute; left:${z.text.x}px; top:${z.text.y}px;
          width:${z.text.width}px; height:${z.text.height}px;
          display:flex; flex-direction:column; justify-content:center; }
  /* Measured: the headline caps run about 120px tall in the references, so
     the starting size is well above that and the fit script brings it down. */
  .hl { font-family:"ElkHead", system-ui, sans-serif; text-transform:uppercase;
        font-size:132px; line-height:0.94; letter-spacing:-1px; white-space:nowrap; }
  .accent { color:${p.green}; }
  .support { margin-top:30px; font-size:31px; line-height:1.3; max-width:${z.text.width - 20}px; }

  /* The depth is a hard offset shadow, not a second element: an absolutely
     positioned pill gets its width capped by the container and ends up
     narrower and lower than the face, which is exactly how it first went
     wrong. A shadow follows the border radius for free. */
  .cta { margin-top:48px; align-self:flex-start; background:${p.green}; color:${p.navyDark};
         font-weight:600; font-size:32px; padding:20px 44px; border-radius:999px;
         box-shadow:${CTA_DEPTH}px ${CTA_DEPTH}px 0 ${p.greenDeep}; }

  .product { position:absolute; left:${z.product.x}px; top:0;
             width:${z.product.width}px; height:${height}px;
             display:flex; align-items:center; justify-content:center; }
  .product canvas, .product img { max-width:${productW}px; max-height:${productH}px;
             width:auto; height:auto; object-fit:contain; }

  /* Measured spacing: the badges sit well apart, but the yellow bar hugs the
     price — 17 to 26 pixels between them in every banner that has both. */
  .side { position:absolute; left:${z.side.x}px; top:${z.side.y}px;
          width:${z.side.width}px; height:${z.side.height}px;
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
  .bar { background:${p.yellow}; color:${p.navyDark}; font-family:"ElkHead", system-ui, sans-serif;
         font-size:44px; line-height:1; padding:13px 22px; text-transform:uppercase; }
  .circle { background:${p.pink}; color:${p.white}; font-weight:600; font-size:30px; text-align:center;
            width:196px; height:196px; border-radius:50%; display:flex; align-items:center; justify-content:center; padding:20px; }
  .price { font-family:"ElkHead", system-ui, sans-serif; font-size:124px; line-height:0.92; }
  .was { font-size:26px; opacity:0.88; margin-top:6px; }
  .pname { font-size:23px; font-weight:600; line-height:1.3; max-width:${z.side.width - 10}px; }

  .fine { position:absolute; left:0; bottom:22px; width:100%; text-align:center;
          font-size:17px; opacity:0.8; }
</style>

<div class="text">
  ${headline}
  <div class="support">${esc(brief.copy.support)}</div>
  <div class="cta">${esc(brief.copy.cta)}</div>
</div>

<div class="product"><canvas id="shot"></canvas></div>

<div class="side">
  ${looseBadges}
  <div class="block">
    ${tightBadges}
    <div>
      <div class="price">${esc(brief.product.priceText)}</div>
      ${oldPrice?.amount !== undefined ? `<div class="was">${BEFORE_WORD[brief.language]} ${esc(priceText(oldPrice.amount))}</div>` : ''}
      <div class="pname">${esc(brief.product.name)}</div>
    </div>
  </div>
</div>

${brief.finePrint ? `<div class="fine">${esc(brief.finePrint)}</div>` : ''}

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
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = ${JSON.stringify(`file://${productFile}`)}; });

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
</script>`;
}

/**
 * Downloads the product photograph next to the page.
 *
 * It has to be local: the CDN sends no CORS header, so a remote image taints
 * the canvas and the cut-out cannot read a single pixel.
 */
async function fetchProduct(url: string, path: string): Promise<void> {
  if (existsSync(path)) return;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`product image: HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

export async function renderBanner(
  brief: ArtDirectorBrief,
  direction: ArtDirection,
  opts: RenderOptions,
): Promise<RenderResult> {
  mkdirSync(opts.outDir, { recursive: true });
  const dir = resolve(opts.outDir);
  const ext = (brief.product.image.split('.').pop() ?? 'jpg').split('?')[0];
  const productFile = `${dir}/${opts.name}-product.${ext}`;
  await fetchProduct(brief.product.image, productFile);

  const htmlPath = `${dir}/${opts.name}.html`;
  const pngPath = `${dir}/${opts.name}.png`;
  writeFileSync(htmlPath, bannerHtml(brief, direction, productFile));

  await run(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    // Needed for the cut-out: without it the local image taints the canvas.
    '--allow-file-access-from-files',
    // Lets the fonts load and the in-page script finish before the shot.
    '--virtual-time-budget=8000',
    /**
     * Chrome's page background is white, and one render caught a five-pixel
     * white strip along the bottom edge where the gradient had not painted
     * yet. It did not reproduce, which makes it worse rather than better: an
     * intermittent white band on a finished banner is not something to leave
     * to chance. Painting the page the banner's own darkest navy makes the
     * same slip invisible.
     */
    `--default-background-color=${PALETTE_NAVY_DARK}ff`,
    `--screenshot=${pngPath}`,
    `--window-size=${brief.canvas.width},${brief.canvas.height}`,
    `file://${htmlPath}`,
  ], { maxBuffer: 1 << 24 }).catch((e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    throw new Error(`chrome: ${m.split('\n')[0]}`);
  });

  if (!existsSync(pngPath)) throw new Error('chrome produced no png');
  return { png: pngPath, html: htmlPath, width: brief.canvas.width, height: brief.canvas.height };
}
