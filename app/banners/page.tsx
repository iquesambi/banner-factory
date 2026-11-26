import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { listJobs } from '@/app/lib/jobs.js';
import { get as currentProduct } from '@/app/lib/search.js';
import {
  LANGUAGE_LABEL, VERDICT_LABEL, VERDICT_STAGES, allGood, anyBad, anyVerdict,
  kr, type Job,
} from '@/app/lib/types';
import { amortised } from '@/app/lib/spend';
import { DeleteBanner } from '@/app/components/delete-banner';
import { PublishBanner } from '@/app/components/publish-banner';

export const dynamic = 'force-dynamic';

type Validity = 'all' | 'valid' | 'expired';
type Origin = 'all' | 'made' | 'reused';
type Verdict = 'all' | 'liked' | 'disliked' | 'unrated';

interface Filters {
  lang: string;
  validity: Validity;
  origin: Origin;
  verdict: Verdict;
}

/**
 * Filters live in the URL rather than in component state.
 *
 * The page is server-rendered from the job files, so filtering here costs
 * nothing and needs no client bundle — and a filtered view can be linked to,
 * which matters for the one thing this page is for: showing someone a specific
 * slice of what has been made.
 */
function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v) ?? 'all';
  };
  const oneOf = <T extends string>(key: string, allowed: readonly T[]): T => {
    const v = one(key) as T;
    return allowed.includes(v) ? v : (allowed[0] as T);
  };
  return {
    lang: one('lang'),
    validity: oneOf('validity', ['all', 'valid', 'expired'] as const),
    origin: oneOf('origin', ['all', 'made', 'reused'] as const),
    verdict: oneOf('verdict', ['all', 'liked', 'disliked', 'unrated'] as const),
  };
}

function href(current: Filters, key: keyof Filters, value: string): string {
  const next = { ...current, [key]: value };
  const query = Object.entries(next)
    .filter(([, v]) => v !== 'all')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `/banners?${query}` : '/banners';
}

interface Row {
  job: Job;
  live: { price: number } | null;
  drawnAt: number | null;
  expired: boolean;
}

/**
 * The acquis and its validity.
 *
 * A stored banner is reusable only while the facts printed on it are still
 * true. That is checked here against the live feed rather than assumed: the
 * price the banner was drawn with is compared to the price in the catalogue
 * now, and a banner whose price has moved is marked expired.
 */
export default async function BannersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = readFilters(await searchParams);
  const jobs = listJobs();
  const spend = amortised(jobs);

  /**
   * One card per BANNER, not per run.
   *
   * Asking for the same banner twice produces two jobs that share one image,
   * and showing both is two cards of the same picture. They collapse onto the
   * run that actually drew it, the same way the board does.
   */
  const byImage = new Map<string, Job>();
  /** How many runs answered with each image, for what a delete will take. */
  const shareCount = new Map<string, number>();
  for (const job of jobs) {
    if (!job.png || !job.brief) continue;
    shareCount.set(job.png, (shareCount.get(job.png) ?? 0) + 1);
    const held = byImage.get(job.png);
    if (!held || (held.reuse && !job.reuse)) byImage.set(job.png, job);
  }

  const all: Row[] = [...byImage.values()].map((job) => {
    const live = job.pick ? currentProduct(job.pick.sku) : null;
    const drawnAt = job.brief?.product.price ?? null;
    return { job, live, drawnAt, expired: live !== null && drawnAt !== null && live.price !== drawnAt };
  });

  const languages = [...new Set(all.map((r) => r.job.language))].sort();

  const rows = all.filter(({ job, expired }) => {
    if (filters.lang !== 'all' && job.language !== filters.lang) return false;
    if (filters.validity === 'valid' && expired) return false;
    if (filters.validity === 'expired' && !expired) return false;
    if (filters.origin === 'made' && job.reuse) return false;
    if (filters.origin === 'reused' && !job.reuse) return false;
    if (filters.verdict === 'liked' && !allGood(job.verdicts)) return false;
    if (filters.verdict === 'disliked' && !anyBad(job.verdicts)) return false;
    if (filters.verdict === 'unrated' && anyVerdict(job.verdicts)) return false;
    return true;
  });

  const expiredCount = all.filter((r) => r.expired).length;
  const filtered = rows.length !== all.length;

  return (
    <main className="mx-auto max-w-[1240px] px-8 pb-16 pt-5">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Banners already made</h1>
      <p className="mb-6 max-w-[640px] text-[13.5px] leading-relaxed text-muted-foreground">
        A stored banner is reusable only while the facts printed on it are still true. When a price moves, the banner
        expires on its own.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Stat label="Banners on record" value={String(all.length)} note="across the languages used" />
        <Stat
          label="Expired on a fact change"
          value={String(expiredCount)}
          note={expiredCount ? 'price moved in the feed' : 'all still match the feed'}
          tone={expiredCount ? 'amber' : 'plain'}
        />
        {/*
          The number that matters once reuse exists.
          Spending divided by every banner DELIVERED, not by every banner
          drawn: a reused one costs nothing and still adds to the count, so
          this figure falls each time the factory answers without working.
        */}
        <Stat
          label="Cost per banner"
          value={spend.perDelivered === null ? '—' : money(spend.perDelivered)}
          note={
            spend.reused
              ? `${money(spend.total ?? 0)} over ${spend.delivered} delivered · ${spend.reused} of them reused`
              : `${money(spend.total ?? 0)} over ${spend.delivered} delivered`
          }
          tone="green"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-start gap-x-7 gap-y-3 rounded-[11px] border bg-secondary/40 px-4 py-3">
        <FilterRow label="Language" current={filters} name="lang"
          options={[{ value: 'all', label: 'Any' },
            ...languages.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))]} />
        <FilterRow label="State" current={filters} name="validity"
          options={[{ value: 'all', label: 'Any' }, { value: 'valid', label: 'Valid' }, { value: 'expired', label: 'Expired' }]} />
        <FilterRow label="Origin" current={filters} name="origin"
          options={[{ value: 'all', label: 'Any' }, { value: 'made', label: 'Drawn' }, { value: 'reused', label: 'Reused' }]} />
        <FilterRow label="Review" current={filters} name="verdict"
          options={[{ value: 'all', label: 'Any' }, { value: 'liked', label: 'Liked' }, { value: 'disliked', label: 'Disliked' }, { value: 'unrated', label: 'Not reviewed' }]} />
      </div>

      {filtered && (
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          Showing {rows.length} of {all.length}.{' '}
          <Link href="/banners" className="underline underline-offset-2">Clear the filters</Link>
        </p>
      )}

      {all.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No banner has been drawn yet.{' '}
            <Link href="/" className="font-medium text-foreground underline underline-offset-2">
              Make one
            </Link>
            .
          </p>
        </div>
      )}

      {all.length > 0 && rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing matches these filters.{' '}
            <Link href="/banners" className="font-medium text-foreground underline underline-offset-2">
              Clear them
            </Link>
            .
          </p>
        </div>
      )}

      <ul className="flex flex-wrap gap-4">
        {rows.map(({ job, live, drawnAt, expired }) => (
          <li key={job.id} className="min-w-[320px] flex-[1_1_340px] overflow-hidden rounded-xl border">
            <Link href={`/board/${job.id}`} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/banners/${encodeURIComponent(job.png as string)}`}
                alt={`Banner for ${job.pick?.name ?? job.seed.name}`}
                width={2048}
                height={768}
                className={expired ? 'block w-full opacity-45' : 'block w-full'}
              />
              <div className="px-4 py-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {expired ? <Badge tone="amber">expired</Badge> : <Badge tone="green">valid</Badge>}
                  <Badge>{LANGUAGE_LABEL[job.language]}</Badge>
                  {job.reuse && <Badge tone="green">reused</Badge>}
                  {/*
                    One mark per stage judged, so the card says WHAT was
                    wrong rather than that something was.
                  */}
                  {VERDICT_STAGES.filter((st) => job.verdicts[st]).map((st) => (
                    <Badge key={st} tone={job.verdicts[st]!.value === 'up' ? 'green' : 'amber'}>
                      {VERDICT_LABEL[st].replace('The ', '')}
                      {job.verdicts[st]!.value === 'up' ? ' ✓' : ' ✗'}
                    </Badge>
                  ))}
                </div>
                <div className="text-[13.5px] font-medium leading-snug">{job.pick?.name ?? job.seed.name}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {expired && live && drawnAt !== null
                    ? `Drawn at ${kr(drawnAt)}, the feed now says ${kr(live.price)}. Showing it would be a false claim.`
                    : `Drawn from seed ${job.seed.sku}. Still matches the feed.`}
                </p>
              </div>
            </Link>
            {/*
              Outside the link: it is an action, not navigation, and a delete
              inside an anchor is one mis-click from a surprise.
            */}
            <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
              <PublishBanner jobId={job.id} published={Boolean(job.published)} />
              <DeleteBanner
                png={job.png as string}
                alsoFrom={(shareCount.get(job.png as string) ?? 1) - 1}
              />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * One filter, as a label over its chips.
 *
 * Stacked rows with the label beside them wasted the width and read as a
 * form; side by side they read as four small controls, which is what they
 * are.
 */
function FilterRow({
  label,
  name,
  options,
  current,
}: {
  label: string;
  name: keyof Filters;
  options: Array<{ value: string; label: string }>;
  current: Filters;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = current[name] === o.value;
        return (
          <Link
            key={o.value}
            href={href(current, name, o.value)}
            className={
              active
                ? 'rounded-full bg-elgi-navy px-2.5 py-1 text-[12px] font-medium text-white'
                : 'rounded-full border bg-card px-2.5 py-1 text-[12px] text-slate-700 hover:border-slate-400'
            }
          >
            {o.label}
          </Link>
        );
      })}
      </div>
    </div>
  );
}

/** Fractions of a cent, so cents with two decimals is the readable unit. */
function money(usd: number): string {
  const cents = usd * 100;
  return cents < 1 ? `${cents.toFixed(2)} cents` : `$${usd.toFixed(4)}`;
}

function Stat({
  label,
  value,
  note,
  tone = 'plain',
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'plain' | 'amber' | 'green';
}) {
  const colour = tone === 'amber' ? '#b45309' : tone === 'green' ? '#4d7d14' : undefined;
  return (
    <div className="min-w-[190px] flex-[1_1_200px] rounded-[11px] border px-4 py-3.5">
      <div className="mb-1 text-[12.5px] text-muted-foreground">{label}</div>
      <div className="tnum text-[23px] font-semibold tracking-tight" style={{ color: colour }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
