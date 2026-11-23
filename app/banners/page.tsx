import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { listJobs } from '@/app/lib/jobs.js';
import { get as currentProduct } from '@/app/lib/search.js';
import { LANGUAGE_LABEL, kr } from '@/app/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The acquis and its validity.
 *
 * A stored banner is reusable only while the facts printed on it are still
 * true. That is checked here against the live feed rather than assumed: the
 * price the banner was drawn with is compared to the price in the catalogue
 * now, and a banner whose price has moved is marked expired.
 */
export default function BannersPage() {
  const made = listJobs().filter((j) => j.png && j.brief);

  const rows = made.map((job) => {
    const live = job.pick ? currentProduct(job.pick.sku) : null;
    const drawnAt = job.brief?.product.price ?? null;
    const expired = live !== null && drawnAt !== null && live.price !== drawnAt;
    return { job, live, drawnAt, expired };
  });

  const expiredCount = rows.filter((r) => r.expired).length;

  return (
    <main className="mx-auto max-w-[1240px] px-8 pb-16 pt-5">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Banners already made</h1>
      <p className="mb-6 max-w-[640px] text-[13.5px] leading-relaxed text-muted-foreground">
        A stored banner is reusable only while the facts printed on it are still true. When a price moves, the banner
        expires on its own.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Stat label="Banners on record" value={String(rows.length)} note="across the languages used" />
        <Stat
          label="Expired on a fact change"
          value={String(expiredCount)}
          note={expiredCount ? 'price moved in the feed' : 'all still match the feed'}
          tone={expiredCount ? 'amber' : 'plain'}
        />
      </div>

      {rows.length === 0 && (
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
                  {job.rating === 'up' && <Badge tone="green">liked</Badge>}
                  {job.rating === 'down' && <Badge tone="amber">{job.ratingReason ?? 'poor'}</Badge>}
                </div>
                <div className="text-[13.5px] font-medium leading-snug">{job.pick?.name ?? job.seed.name}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {expired && live && drawnAt !== null
                    ? `Drawn at ${kr(drawnAt)}, the feed now says ${kr(live.price)}. Showing it would be a false claim.`
                    : `Drawn from seed ${job.seed.sku}. Still matches the feed.`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
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
  tone?: 'plain' | 'amber';
}) {
  return (
    <div className="min-w-[190px] flex-[1_1_200px] rounded-[11px] border px-4 py-3.5">
      <div className="mb-1 text-[12.5px] text-muted-foreground">{label}</div>
      <div
        className="tnum text-[23px] font-semibold tracking-tight"
        style={{ color: tone === 'amber' ? '#b45309' : undefined }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
