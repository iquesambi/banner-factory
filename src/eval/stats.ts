/** Deterministic RNG so a sample can be reproduced from its seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample<T>(items: T[], n: number, rng: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(...pool.splice(Math.floor(rng() * pool.length), 1));
  }
  return out;
}

/**
 * Wilson score interval. At n=25 the uncertainty is wide, and reporting a bare
 * percentage would overstate what the sample can tell us.
 */
export function wilson(successes: number, total: number, z = 1.96) {
  if (total === 0) return { point: 0, low: 0, high: 0 };
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denom;
  const half =
    (z / denom) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    point: p,
    low: Math.max(0, center - half),
    high: Math.min(1, center + half),
  };
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
