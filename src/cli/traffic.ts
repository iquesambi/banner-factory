/**
 * A traffic simulator, and nothing more than that.
 *
 *   npm run traffic                            what has been measured so far
 *   npm run traffic -- --job=63e2d383 --impressions=2000 --rate=0.021
 *   npm run traffic -- --experiment=ab12cd34 --impressions=4000 --rate=0.02 --lift=0.25
 *   npm run traffic -- --clear
 *
 * There is no live site behind this project, so without something like this
 * the measurement tool cannot be exercised at all. Everything it writes goes
 * into a SEPARATE pair of counters that is never added to real traffic, is
 * labelled on every screen that shows it, and is refused as evidence by the
 * prompt-improvement loop.
 *
 * It is a coin weighted by a rate you choose. It is not a model of customer
 * behaviour, it cannot tell you whether a banner is good, and a result that
 * comes out of it is a result about this script.
 */
import {
  countsOf, experimentOf, loadExperiments, loadTraffic, record, saveTraffic,
} from '../experiment/index.js';
import { pct } from '../experiment/stats.js';

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const num = (name: string, fallback: number): number => {
  const raw = flag(name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

if (args.includes('--clear')) {
  const book = loadTraffic();
  const kept: typeof book = {};
  for (const [id, tally] of Object.entries(book)) {
    if (tally.real.impressions > 0) kept[id] = { ...tally, simulated: { impressions: 0, clicks: 0 } };
  }
  saveTraffic(kept);
  console.log('Simulated traffic cleared. Real traffic, where there was any, is untouched.');
  process.exit(0);
}

/** Bernoulli draws, which is what a click rate actually is. */
function clicksFrom(impressions: number, rate: number): number {
  let clicks = 0;
  for (let i = 0; i < impressions; i++) if (Math.random() < rate) clicks++;
  return clicks;
}

function pour(jobId: string, impressions: number, rate: number, label: string): void {
  const clicks = clicksFrom(impressions, rate);
  let book = loadTraffic();
  book = record(book, jobId, 'impression', true, impressions);
  if (clicks) book = record(book, jobId, 'click', true, clicks);
  saveTraffic(book);
  console.log(
    `${label.padEnd(12)} ${jobId}  ${impressions.toLocaleString('en-GB')} impressions, ${clicks} clicks (${pct(clicks / impressions)})`,
  );
}

const experimentId = flag('experiment');
const jobId = flag('job');
const impressions = Math.max(1, Math.round(num('impressions', 1000)));
const rate = Math.min(Math.max(num('rate', 0.02), 0), 1);

if (experimentId) {
  const experiment = experimentOf(loadExperiments(), experimentId);
  if (!experiment?.variantJobId) {
    console.error(`no experiment ${experimentId}, or it has no variant yet`);
    process.exit(1);
  }
  /**
   * The lift is yours to set, and that is the point of the switch: run it at
   * 0 to see what an honest null result looks like before trusting the tool
   * to tell you about a real one.
   */
  const lift = num('lift', 0);
  console.log(
    `Simulating ${experiment.product}: control at ${pct(rate)}, variant at ${pct(rate * (1 + lift))}\n`,
  );
  pour(experiment.controlJobId, impressions, rate, 'control');
  pour(experiment.variantJobId, impressions, rate * (1 + lift), 'variant');
  console.log(`\nThe test needs ${experiment.requiredPerArm.toLocaleString('en-GB')} impressions an arm.`);
  process.exit(0);
}

if (jobId) {
  pour(jobId, impressions, rate, 'banner');
  process.exit(0);
}

/* ------------------------------------------------------------------ status */

const traffic = loadTraffic();
const ids = Object.keys(traffic);
if (!ids.length) {
  console.log('Nothing measured yet.');
  console.log('\n  npm run traffic -- --job=<jobId> --impressions=2000 --rate=0.02');
  process.exit(0);
}

console.log('banner      source      impressions   clicks     rate');
for (const id of ids) {
  const { counts, source } = countsOf(traffic[id]);
  console.log(
    `${id.padEnd(11)} ${source.padEnd(11)} ${String(counts.impressions).padStart(11)} ${String(counts.clicks).padStart(8)} ${pct(counts.impressions ? counts.clicks / counts.impressions : 0).padStart(8)}`,
  );
}
