/**
 * The arithmetic behind "did the new banner actually do better".
 *
 * Nothing here asks a model anything. A p-value is not a judgement call and a
 * model that produced one would be making it up; this is the one part of the
 * system where the answer is computed or it is worthless.
 *
 * Three things it is careful about, because they are the three ways A/B tests
 * lie in practice:
 *
 *   1. A rate on its own is not a result. 2 clicks out of 11 is 18% and means
 *      nothing, so every rate here comes with an interval that says how wide
 *      the uncertainty is.
 *
 *   2. Stopping when the numbers look good is how a coin flip becomes a
 *      discovery. The required sample is computed BEFORE the test starts and
 *      a reading taken earlier is reported as a peek, not as a result.
 *
 *   3. A p-value says how surprising the difference would be if the two
 *      banners were identical. It does not say the variant is better by X%,
 *      and nothing in this file pretends otherwise.
 */

/**
 * The normal CDF, by Abramowitz and Stegun 7.1.26 on the error function.
 * Accurate to about 1.5e-7, which is five digits more than a p-value needs.
 */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1
    - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592)
      * t
      * Math.exp(-x * x);
  return sign * y;
}

/** The inverse, for turning a confidence level into a z. Acklam's approximation. */
export function zFor(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!)
      / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - lo) return -zFor(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q
    / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

export interface Interval { low: number; high: number }

/**
 * The Wilson interval for a proportion.
 *
 * Not the textbook normal interval, which at small counts produces bounds
 * below zero and above one and is embarrassing on exactly the data this tool
 * will have in its first week.
 */
export function wilson(successes: number, trials: number, confidence = 0.95): Interval {
  if (trials <= 0) return { low: 0, high: 1 };
  const z = zFor(1 - (1 - confidence) / 2);
  const p = successes / trials;
  const d = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const spread = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  return { low: Math.max(0, (centre - spread) / d), high: Math.min(1, (centre + spread) / d) };
}

export interface Arm { impressions: number; clicks: number }

export interface Comparison {
  control: { rate: number; interval: Interval } & Arm;
  variant: { rate: number; interval: Interval } & Arm;
  /** Variant minus control, in percentage points. */
  absoluteLift: number;
  /** The same as a share of the control's rate, which is how people talk. */
  relativeLift: number;
  z: number;
  /** Two-sided: we are equally interested in the variant being worse. */
  p: number;
  /** Null when either arm has no impressions. */
  usable: boolean;
}

/**
 * The two-proportion z-test, pooled.
 *
 * Two-sided on purpose. A one-sided test would be asking "is the new one
 * better", which quietly assumes it cannot be worse and halves the p-value
 * for the privilege. Finding out the variant lost is a real outcome of this
 * tool and it should cost the same evidence as finding out it won.
 */
export function compare(control: Arm, variant: Arm, confidence = 0.95): Comparison {
  const rate = (a: Arm) => (a.impressions > 0 ? a.clicks / a.impressions : 0);
  const p1 = rate(control);
  const p2 = rate(variant);
  const usable = control.impressions > 0 && variant.impressions > 0;

  const pooled = usable
    ? (control.clicks + variant.clicks) / (control.impressions + variant.impressions)
    : 0;
  const se = usable
    ? Math.sqrt(pooled * (1 - pooled) * (1 / control.impressions + 1 / variant.impressions))
    : 0;
  const z = se > 0 ? (p2 - p1) / se : 0;
  const p = se > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;

  return {
    control: { ...control, rate: p1, interval: wilson(control.clicks, control.impressions, confidence) },
    variant: { ...variant, rate: p2, interval: wilson(variant.clicks, variant.impressions, confidence) },
    absoluteLift: p2 - p1,
    relativeLift: p1 > 0 ? (p2 - p1) / p1 : 0,
    z,
    p,
    usable,
  };
}

/**
 * How many impressions each arm needs before the answer means anything.
 *
 * Worked out from the rate we already see and the smallest improvement worth
 * acting on. Asking for a 5% relative lift to be detectable on a 1% click
 * rate is tens of thousands of impressions per arm, and it is much better to
 * learn that before the test than to stare at an inconclusive one for a week.
 */
export function requiredPerArm(
  baselineRate: number,
  relativeMde = 0.2,
  alpha = 0.05,
  power = 0.8,
): number {
  const p1 = Math.min(Math.max(baselineRate, 0.0005), 0.9995);
  const p2 = Math.min(p1 * (1 + relativeMde), 0.9999);
  const zA = zFor(1 - alpha / 2);
  const zB = zFor(power);
  const n = ((zA + zB) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1) ** 2;
  return Math.ceil(n);
}

export type Reading = 'empty' | 'peek' | 'conclusive' | 'inconclusive';

/**
 * What a reading is allowed to be called.
 *
 * Before the planned sample it is a peek, whatever the p-value says, and the
 * screen says so. This is the rule that stops the tool from being a machine
 * for finding significance in noise: with enough looks at a fair coin, one of
 * them always crosses 0.05.
 */
export function readingOf(c: Comparison, required: number, alpha = 0.05): Reading {
  if (!c.usable) return 'empty';
  if (c.control.impressions < required || c.variant.impressions < required) return 'peek';
  return c.p < alpha ? 'conclusive' : 'inconclusive';
}

export function pct(n: number, places = 2): string {
  return `${(n * 100).toFixed(places)}%`;
}
