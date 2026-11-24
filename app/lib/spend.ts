import type { Job } from './types';

/**
 * What a banner actually costs, once reuse is in the picture.
 *
 * Per-run cost is already on every card, and on its own it flatters the
 * factory: it only ever counts runs that spent something. The honest figure
 * divides everything spent by every banner DELIVERED — and a reused banner is
 * a delivery that cost nothing, so it pushes the average down. That is the
 * whole point of the reuse module, and this is the number that shows it
 * working.
 *
 * Spending is counted across ALL jobs, including the ones that failed before
 * producing anything. A run that burned four calls and then died is money
 * spent; leaving it out would make the average a sales figure rather than a
 * measurement.
 */
export interface Spend {
  /** Everything spent, or null when any run used a model with no known rate. */
  total: number | null;
  /** Banners handed over: drawn plus reused. */
  delivered: number;
  /** Of those, the ones a run actually drew. */
  made: number;
  /** Of those, the ones answered from an existing banner. */
  reused: number;
  /** Runs that spent money without producing a banner. */
  failed: number;
  /** total / delivered — the real cost of a banner. */
  perDelivered: number | null;
  /** total / made — what it would cost with no reuse at all. */
  perMade: number | null;
  /** How many runs had no rate, so the total is a floor rather than a figure. */
  unpriced: number;
}

export function amortised(jobs: Job[]): Spend {
  let total = 0;
  let unpriced = 0;
  let delivered = 0;
  let made = 0;
  let reused = 0;
  let failed = 0;

  for (const job of jobs) {
    if (job.cost.usd === null) {
      // Only a run that actually called something counts as unpriced; a run
      // that spent nothing has a known cost of zero.
      if (job.cost.calls > 0) unpriced++;
    } else {
      total += job.cost.usd;
    }

    if (job.png) {
      delivered++;
      if (job.reuse) reused++;
      else made++;
    } else if (job.cost.calls > 0) {
      failed++;
    }
  }

  const div = (n: number, by: number) => (by > 0 ? n / by : null);
  return {
    total,
    delivered,
    made,
    reused,
    failed,
    perDelivered: div(total, delivered),
    perMade: div(total, made),
    unpriced,
  };
}
