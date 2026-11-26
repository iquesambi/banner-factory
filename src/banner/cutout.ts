import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Cutting the product out of its photograph, with a model.
 *
 * The flood fill that used to do this reads colour: it walks in from the
 * border and takes everything light that is connected to it. That works
 * until the product is the same colour as the paper it was shot on — a white
 * charger, a white dishwasher — and then it walks straight through the
 * product and eats it. No threshold fixes that, because the information
 * simply is not there in the pixel values. A segmentation model has the one
 * thing the fill lacks: it knows what a charger looks like.
 *
 * The model used is RMBG-1.4, a 176 MB ONNX run on the CPU in about half a
 * second. It is a MASK, not a picture: the alpha it produces is applied to
 * the original pixels, so the product on the banner is still the photograph
 * from the feed, not a redrawing of it. That matters more here than anywhere
 * else in this system — everything on the banner is supposed to be true.
 *
 * It is deliberately not trusted blindly. See `mistrusted` below.
 */

/** The model's fixed input. RMBG-1.4 is exported without dynamic axes. */
const SIDE = 1024;

const MODEL_URL =
  process.env.CUTOUT_MODEL_URL ?? 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx';
const MODEL_PATH = process.env.CUTOUT_MODEL ?? '.cache/models/rmbg-1.4.onnx';
const CUTOUT_DIR = '.cache/cutouts';

export type CutoutHow = 'model' | 'cached' | 'mistrusted' | 'unavailable';

export interface Cutout {
  /** A PNG with an alpha channel, or null when the caller should fall back. */
  path: string | null;
  how: CutoutHow;
  /** Share of the photograph the model kept, for the log. */
  kept?: number;
  note?: string;
}

/**
 * Loaded once per process and kept: the session costs about a second to
 * build and the factory renders many banners in a row.
 */
let session: Promise<Session | null> | null = null;

interface Session {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
  inputNames: string[];
  outputNames: string[];
}

/**
 * The weights are not in the repository — 176 MB has no business in git, and
 * they are not mine to redistribute. They are fetched once, to `.cache`, and
 * written through a temporary name so an interrupted download cannot leave a
 * half file that looks valid.
 */
async function ensureModel(): Promise<string | null> {
  const path = resolve(MODEL_PATH);
  if (existsSync(path)) return path;

  mkdirSync(dirname(path), { recursive: true });
  process.stderr.write(`cut-out: fetching the model once (~176 MB) → ${MODEL_PATH}\n`);
  try {
    const res = await fetch(MODEL_URL, { signal: AbortSignal.timeout(600_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    /** A redirect to an HTML error page would be small and useless. */
    if (bytes.length < 10_000_000) throw new Error(`got ${bytes.length} bytes, expected ~176 MB`);
    const tmp = `${path}.part`;
    writeFileSync(tmp, bytes);
    renameSync(tmp, path);
    return path;
  } catch (e) {
    process.stderr.write(`cut-out: no model (${e instanceof Error ? e.message : String(e)})\n`);
    return null;
  }
}

async function load(): Promise<Session | null> {
  const path = await ensureModel();
  if (!path) return null;
  try {
    const ort = await import('onnxruntime-node');
    return (await ort.InferenceSession.create(path)) as unknown as Session;
  } catch (e) {
    process.stderr.write(`cut-out: onnxruntime unavailable (${e instanceof Error ? e.message : String(e)})\n`);
    return null;
  }
}

/**
 * Does the mask look like it found the product?
 *
 * Two failures showed up over the sample and both are the same shape: the
 * model locks onto a part of the product rather than the product. A fridge
 * with a screen in its door came back as the screen alone; an SSD came back
 * empty.
 *
 * The check is a second opinion from the old method. `ink` is the share of
 * the photograph that differs from its corner colour — a crude estimate of
 * how much of the frame is not background, and crude is fine, because the
 * two are being COMPARED and not believed. Over 27 products the ratio of
 * mask to ink was 0.57 or more for every good cut-out and 0.14 and 0.00 for
 * the two bad ones. The line is drawn at 0.35, in the empty middle.
 *
 * When the mask is mistrusted the caller falls back to the flood fill, which
 * is exactly the case the flood fill handles well: a product that stands out
 * from its background by colour.
 */
function mistrusted(mask: number, ink: number): boolean {
  if (ink <= 0.02) return false; // nothing to compare against: a full-bleed photo
  return mask / ink < 0.35;
}

/** How far from the background colour a pixel must sit to be the product. */
const NOT_BACKGROUND = 3;

/**
 * Deciding the pixels the model is unsure about, by colour.
 *
 * The model finds a charger's body and the plug on the end of its cable, and
 * then loses the cable itself: two metres of thin white cord on white paper
 * come back as a wide grey smear, which on navy reads as dirt rather than as
 * a wire. Thresholding the smear does not help — it is genuinely wide, and
 * hardening it paints a white band where the cord is not.
 *
 * The information the model is missing is in the photograph. A cord is not
 * EXACTLY the paper's colour: it has shading, and an edge. So the two are
 * asked different questions. The model says where to look — anything it is
 * confident about is left alone — and inside the band where it hesitates the
 * pixel's own colour decides: three levels away from the corner colour is
 * the product, nearer than that is paper.
 *
 * That alone leaves the cord notched — where it happens to be exactly the
 * paper's white, the test drops it and the wire comes out dashed. A closing
 * (grow by two pixels, then shrink by the same two) bridges the nicks
 * without thickening anything: growing and shrinking by the same amount
 * returns a solid shape to its own outline. The confident background is then
 * re-imposed, so the closing can only act inside the band, and one round of
 * a 3 × 3 majority takes off the JPEG noise a threshold that tight picks up.
 */
function refine(conf: Buffer, rgb: Buffer, width: number, height: number): Buffer {
  const at = (x: number, y: number) => (y * width + x) * 3;
  const corners = [
    at(2, 2),
    at(width - 3, 2),
    at(2, height - 3),
    at(width - 3, height - 3),
  ];
  const bg = [0, 1, 2].map((c) => corners.reduce((a, p) => a + rgb[p + c]!, 0) / 4);

  const n = width * height;
  let cur = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = conf[i]!;
    if (c >= 230) { cur[i] = 255; continue; }
    if (c <= 25) continue;
    const d = Math.max(
      Math.abs(rgb[i * 3]! - bg[0]!),
      Math.abs(rgb[i * 3 + 1]! - bg[1]!),
      Math.abs(rgb[i * 3 + 2]! - bg[2]!),
    );
    if (d >= NOT_BACKGROUND) cur[i] = 255;
  }

  /** Grow, then shrink by the same radius: the nicks close, the outline stays. */
  const morph = (src: Uint8Array, r: number, grow: boolean): Uint8Array<ArrayBuffer> => {
    const next = new Uint8Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let hit = grow ? 0 : 1;
        for (let dy = -r; dy <= r; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          let stop = false;
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            const v = src[yy * width + xx] !== 0;
            if (grow && v) { hit = 1; stop = true; break; }
            if (!grow && !v) { hit = 0; stop = true; break; }
          }
          if (stop) break;
        }
        next[y * width + x] = hit ? 255 : 0;
      }
    }
    return next;
  };

  cur = morph(morph(cur, 2, true), 2, false);
  /** The closing may only act inside the band, never on settled background. */
  for (let i = 0; i < n; i++) if (conf[i]! <= 25) cur[i] = 0;

  const next = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0, seen = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          seen++;
          if (cur[yy * width + xx]) on++;
        }
      }
      if (on * 2 > seen) next[y * width + x] = 255;
    }
  }
  return Buffer.from(next);
}

/**
 * The cut-out for a product photograph, or null if the caller should fall
 * back to the in-page flood fill.
 *
 * Cached by the photograph's content hash: the same product reused across
 * banners and languages is cut once.
 */
export async function cutOutProduct(photo: string): Promise<Cutout> {
  const hash = createHash('sha1').update(readFileSync(photo)).digest('hex').slice(0, 16);
  const out = resolve(`${CUTOUT_DIR}/${hash}.png`);
  if (existsSync(out)) return { path: out, how: 'cached' };

  session ??= load();
  const sess = await session;
  if (!sess) return { path: null, how: 'unavailable' };

  const [{ default: sharp }, ort] = await Promise.all([import('sharp'), import('onnxruntime-node')]);

  const meta = await sharp(photo).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) return { path: null, how: 'unavailable' };
  const { data } = await sharp(photo)
    .resize(SIDE, SIDE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  /**
   * The aspect ratio is not preserved, and that is not an oversight: the
   * export takes 1024 × 1024 and nothing else. Padding to a square was tried
   * and is worse — the model reads the inserted border as an edge and
   * returns the whole photograph as the object.
   */
  const n = SIDE * SIDE;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) input[c * n + i] = data[i * 3 + c]! / 255 - 0.5;
  }

  const result = await sess.run({
    [sess.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, SIDE, SIDE]),
  });
  const pred = result[sess.outputNames[0]!]!.data;

  /** The corner colour, and how much of the frame is not it. */
  const at = (x: number, y: number) => (y * SIDE + x) * 3;
  const corners = [at(2, 2), at(SIDE - 3, 2), at(2, SIDE - 3), at(SIDE - 3, SIDE - 3)];
  const bg = [0, 1, 2].map((c) => corners.reduce((a, p) => a + data[p! + c]!, 0) / 4);
  let ink = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.max(
      Math.abs(data[i * 3]! - bg[0]!),
      Math.abs(data[i * 3 + 1]! - bg[1]!),
      Math.abs(data[i * 3 + 2]! - bg[2]!),
    );
    if (d > 18) ink++;
  }

  let on = 0;
  const alpha = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const v = pred[i]!;
    if (v > 0.5) on++;
    alpha[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }

  const kept = on / n;
  if (mistrusted(kept, ink / n)) {
    return {
      path: null,
      how: 'mistrusted',
      kept,
      note: `kept ${(kept * 100).toFixed(1)}% against ${((ink / n) * 100).toFixed(1)}% non-background`,
    };
  }

  const mask = await sharp(alpha, { raw: { width: SIDE, height: SIDE, channels: 1 } })
    .resize(width, height, { fit: 'fill' })
    /** Without this sharp hands back three channels and the stride is wrong. */
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const refined = refine(mask, await sharp(photo).removeAlpha().raw().toBuffer(), width, height);

  /**
   * Half a pixel of blur, to put the anti-aliasing back.
   *
   * `refine` answers in yes and no, and a hard silhouette scaled up on the
   * banner shows its stairs. The blur is narrower than the cord it has to
   * survive.
   */
  const soft = await sharp(refined, { raw: { width, height, channels: 1 } })
    .blur(0.6)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const base = await sharp(photo).ensureAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = base[i * 4]!;
    rgba[i * 4 + 1] = base[i * 4 + 1]!;
    rgba[i * 4 + 2] = base[i * 4 + 2]!;
    rgba[i * 4 + 3] = soft[i]!;
  }

  mkdirSync(CUTOUT_DIR, { recursive: true });
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(out);

  return { path: out, how: 'model', kept };
}
