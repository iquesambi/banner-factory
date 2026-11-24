'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, cn } from '@/components/ui/primitives';
import { LANGUAGE_LABEL, kr, stockLabel, type Job } from '@/app/lib/types';
import { BannerThumb } from '@/app/components/banner-thumb';
import { Thumbs } from '@/app/components/thumbs';
import { PhotoBox } from '@/app/components/photo-box';
import { describe } from '@/app/lib/describe';

export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);
  /** Other requests that ended on this same banner, by reuse. */
  const [siblings, setSiblings] = useState<Job[]>([]);

  useEffect(() => {
    let live = true;
    const tick = () =>
      fetch(`/api/jobs/${id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('404'))))
        .then((data: { job: Job }) => {
          if (live) setJob(data.job);
        })
        .catch(() => live && setMissing(true));
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);

  /**
   * The same banner can be the answer to several seeds, because a later
   * request reused it. Those are the other seeds, offered as a switch rather
   * than as separate cards nobody asked for.
   */
  useEffect(() => {
    if (!job?.png) return;
    let live = true;
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data: { jobs: Job[] }) => {
        if (!live) return;
        setSiblings(data.jobs.filter((j) => j.png === job.png && j.id !== job.id));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [job?.png, job?.id]);

  if (missing) {
    return (
      <main className="mx-auto max-w-[1180px] px-8 py-10">
        <p className="text-sm text-muted-foreground">No job with that id.</p>
      </main>
    );
  }
  if (!job) {
    return (
      <main className="mx-auto max-w-[1180px] px-8 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const done = job.stage === 'review' || job.stage === 'ready';

  return (
    <main className="min-h-[calc(100vh-56px)] bg-secondary/50 px-8 pb-16 pt-5">
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/board"
          className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to the board
        </Link>

        <article className="overflow-hidden rounded-[14px] border bg-card shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
          <header className="border-b px-6 pb-4 pt-[18px]">
            <div className="mb-3.5 flex flex-wrap items-center gap-2">
              <StageBadge job={job} />
              <Badge>{LANGUAGE_LABEL[job.language]}</Badge>
              <span className="text-[12.5px] text-muted-foreground">{when(job.createdAt)}</span>
            </div>

            <div className="flex flex-wrap items-stretch gap-3.5">
              <ProductBox
                label={siblings.length ? `THE SEED · 1 of ${siblings.length + 1}` : 'THE SEED'}
                name={job.seed.name}
                sku={job.seed.sku}
                price={job.seed.price}
                stock={job.seed.stockBand}
                image={job.seed.image}
                tone="muted"
                others={siblings}
                onPick={(nextId) => router.push(`/board/${nextId}`)}
                currentId={job.id}
              />
              <div className="flex shrink-0 items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-label={job.audience?.mode === 'suggest' ? 'suggests' : 'replaced by'}
                  role="img"
                >
                  <path d="M3 10h13M11.5 5.5L17 10l-5.5 4.5" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {job.pick ? (
                <ProductBox
                  label="ON THE BANNER"
                  name={job.pick.name}
                  sku={job.pick.sku}
                  price={job.pick.price}
                  stock=""
                  image={job.pick.image}
                  tone="green"
                />
              ) : (
                <div className="flex min-w-[240px] flex-1 items-center rounded-[10px] border border-dashed px-3 py-2.5 text-[12.5px] text-muted-foreground">
                  {job.stage === 'failed' ? (job.error ?? 'failed') : 'still choosing…'}
                </div>
              )}

              {done && (
                <div className="flex flex-wrap items-center gap-2">
                  {job.png && (
                    <a href={`/api/banners/${encodeURIComponent(job.png)}`} download>
                      <Button variant="outline">Download PNG</Button>
                    </a>
                  )}
                  <Button>Publish</Button>
                </div>
              )}
            </div>
          </header>

          {job.reuse && (
            <div className="mx-6 mt-5 rounded-[11px] border border-lime-200 bg-lime-50/60 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">reused</Badge>
                <span className="text-[13px] font-semibold text-lime-800">
                  No banner was made for this run
                </span>
                <Link
                  href={`/board/${job.reuse.fromJobId}`}
                  className="text-[12.5px] text-lime-800 underline underline-offset-2"
                >
                  see the original
                </Link>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-lime-900">{job.reuse.note}</p>
            </div>
          )}

          {job.reuseRejected.length > 0 && !job.reuse && (
            <div className="mx-6 mt-5 rounded-[11px] border bg-secondary/50 px-4 py-3.5">
              <div className="text-[12.5px] font-semibold text-slate-700">
                An older banner existed and was not reused
              </div>
              <ul className="mt-1 list-inside list-disc text-[12.5px] leading-relaxed text-muted-foreground">
                {job.reuseRejected.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {job.png && (
            <div className="px-6 pt-5">
              <BannerThumb job={job} className="overflow-hidden rounded-[11px] border" />
            </div>
          )}

          {done && (
            <div className="px-6 pt-[18px]">
              <Thumbs job={job} onChange={setJob} />
            </div>
          )}

          <div className="flex flex-wrap items-start gap-6 px-6 pb-7 pt-[22px]">
            <section className="min-w-0 flex-[999_1_520px]">
              <h2 className="mb-2.5 text-sm font-semibold">How it got here</h2>
              <ol className="mb-[18px] overflow-hidden rounded-[10px] border">
                {job.events.map((e) => {
                  const d = describe(e);
                  if (!d) return null;
                  return (
                    <li key={e.seq} className="flex flex-wrap items-start gap-3 border-t px-3.5 py-2.5 first:border-t-0">
                      <span className="mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border bg-secondary">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="#475569" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div className="min-w-[190px] flex-grow">
                        <div className="text-[13px] font-medium">{d.title}</div>
                        {d.detail && <div className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{d.detail}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        {d.tag && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[11px] font-medium',
                              d.free ? 'bg-lime-100 text-lime-800' : 'bg-secondary text-slate-700',
                            )}
                          >
                            {d.tag}
                          </span>
                        )}
                        <span className="tnum min-w-[48px] text-right text-xs text-muted-foreground">
                          {ms(e.elapsedMs)}
                        </span>
                      </div>
                    </li>
                  );
                })}
                {job.events.length === 0 && (
                  <li className="px-3.5 py-3 text-[12.5px] text-muted-foreground">
                    {job.reuse
                      ? 'Nothing ran. The banner already existed and every fact it prints was checked against today\u2019s feed.'
                      : 'waiting to start\u2026'}
                  </li>
                )}
              </ol>

              {job.audience && (
                <>
                  <h2 className="mb-2.5 text-sm font-semibold">Who this is for</h2>
                  <div className="mb-[18px] overflow-hidden rounded-[10px] border">
                    <div className="border-b bg-secondary/40 px-4 py-3">
                      {job.audience.cluster && (
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Badge tone="navy">{job.audience.cluster.label}</Badge>
                          <span className="text-[11.5px] text-muted-foreground">
                            {job.audience.cluster.by === 'brand'
                              ? 'settled by the brand, no model call'
                              : 'read by the model'}
                          </span>
                        </div>
                      )}
                      {job.audience.profile ? (
                        <p className="text-[13px] leading-relaxed text-slate-700">
                          &ldquo;{job.audience.profile}&rdquo;
                        </p>
                      ) : (
                        <p className="text-[12.5px] text-muted-foreground">
                          The seed was in stock, so the banner is a suggestion rather than a
                          replacement.
                        </p>
                      )}
                    </div>

                    {job.audience.sections.length > 0 && (
                      <div className="px-4 py-3">
                        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Sections searched, in the order chosen
                        </div>
                        <ol className="space-y-2">
                          {job.audience.sections.map((sec, i) => (
                            <li key={sec.path} className="flex gap-2.5">
                              <span className="tnum mt-[1px] text-[12px] text-muted-foreground">{i + 1}</span>
                              <div className="min-w-0">
                                <div className="truncate text-[12.5px] font-medium">{sec.path}</div>
                                <div className="text-[12.5px] leading-snug text-muted-foreground">
                                  {sec.reason}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </>
              )}

              {job.pick && (
                <>
                  <h2 className="mb-2.5 text-sm font-semibold">Why this product</h2>
                  <div className="rounded-[10px] border px-4 py-3.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{job.pick.name}</span>
                      <span className="text-[12.5px] text-muted-foreground">{kr(job.pick.price)}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-700">“{job.pick.reason}”</p>
                  </div>
                </>
              )}
            </section>

            <aside className="min-w-[270px] flex-[1_1_290px]">
              <div className="mb-3.5 overflow-hidden rounded-[10px] border">
                <div className="border-b px-3.5 pb-2.5 pt-3">
                  <h2 className="mb-2 text-[13px] font-semibold">Cost</h2>
                  {/* The money leads. Tokens are how it was arrived at, not the point. */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="tnum text-[27px] font-semibold tracking-tight">
                      {job.cost.usd === null ? '—' : money(job.cost.usd)}
                    </span>
                    {job.cost.usd === null && (
                      <span className="text-[13px] text-muted-foreground">no rate for this model</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {job.cost.tokens.toLocaleString('en-GB')} tokens &middot; {job.cost.calls} model calls
                  </div>
                </div>
                {job.cost.byStep.length > 0 && (
                  <div className="border-b px-3.5 py-2.5">
                    {job.cost.byStep.map((s) => (
                      <div key={s.name} className="flex items-baseline justify-between gap-2.5 py-0.5">
                        <span className="text-[12.5px] text-slate-600">{s.name}</span>
                        <span className="tnum whitespace-nowrap text-[12.5px]">
                          {s.usd !== null && <>{money(s.usd)} &middot; </>}
                          <span className="text-muted-foreground">
                            {s.tokens.toLocaleString('en-GB')} tk
                          </span>
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-2.5 py-0.5 text-muted-foreground">
                      <span className="text-[12.5px]">Generating the image</span>
                      <span className="text-[12.5px]">—</span>
                    </div>
                  </div>
                )}
                {job.cost.rateReadAt && (
                  <p className="border-b px-3.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    Text only. Rates read from Google&rsquo;s pricing page on {job.cost.rateReadAt}; image
                    generation is not in this figure.
                  </p>
                )}
                {job.cost.avoided > 0 && (
                  <div className="flex items-center gap-2 bg-lime-50 px-3.5 py-2.5">
                    <span className="h-[7px] w-[7px] rounded-full bg-elgi-green" />
                    <span className="text-[12.5px] font-semibold text-lime-800">
                      {job.cost.avoided} calls avoided by cache
                    </span>
                  </div>
                )}
              </div>

              {job.brief && <Snapshot job={job} />}
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}

function StageBadge({ job }: { job: Job }) {
  if (job.stage === 'failed') return <Badge tone="amber">Failed</Badge>;
  if (job.stage === 'ready') return <Badge tone="green">Ready</Badge>;
  if (job.stage === 'review') return <Badge tone="amber">Waiting for review</Badge>;
  return <Badge tone="navy">{job.stage}…</Badge>;
}

function ProductBox({
  label,
  name,
  sku,
  price,
  stock,
  image,
  tone,
  others = [],
  onPick,
  currentId,
}: {
  label: string;
  name: string;
  sku: string;
  price: number;
  stock: string;
  image: string | null;
  tone: 'muted' | 'green';
  /** Other jobs that produced this same banner, from a different seed. */
  others?: Job[];
  onPick?: (jobId: string) => void;
  currentId?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-[240px] flex-1 items-center gap-3 rounded-[10px] border px-3.5 py-3',
        tone === 'muted' ? 'bg-secondary/60' : 'border-lime-200 bg-card',
      )}
    >
      <PhotoBox src={image} alt="" className="h-10 w-10" />
      <div className="min-w-0">
        <div className={cn('text-[10.5px] font-bold tracking-wider', tone === 'muted' ? 'text-muted-foreground' : 'text-lime-700')}>
          {label}
        </div>
        {others.length > 0 && onPick && currentId ? (
          <>
            <label className="sr-only" htmlFor="seed-switch">
              Which seed to show
            </label>
            <select
              id="seed-switch"
              value={currentId}
              onChange={(e) => onPick(e.target.value)}
              className="mt-0.5 w-full max-w-full rounded border bg-background px-1.5 py-1 text-[13px] font-medium"
            >
              <option value={currentId}>{name}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.seed.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="mt-0.5 text-[13px] font-medium leading-tight">{name}</div>
        )}
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {sku} · {kr(price)}
          {stock !== '' && <> · <span className="text-orange-700">{stockLabel(stock)}</span></>}
        </div>
      </div>
    </div>
  );
}

function Snapshot({ job }: { job: Job }) {
  const brief = job.brief;
  if (!brief) return null;
  const saving = brief.badges.find((b) => b.kind === 'saving');
  const energy = brief.badges.find((b) => b.kind === 'energy');

  const rows = [
    { name: 'Price', value: brief.product.priceText },
    { name: 'Saving', value: saving?.value ?? 'none' },
    { name: 'Energy class', value: energy?.value ?? '—' },
  ];

  return (
    <div className="overflow-hidden rounded-[10px] border">
      <div className="px-3.5 pb-2.5 pt-3">
        <h2 className="mb-0.5 text-[13px] font-semibold">The product, as it was</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          What the feed said when the banner was drawn, {when(job.createdAt)}.
        </p>
        {rows.map((r) => (
          <div key={r.name} className="flex items-baseline justify-between gap-2.5 border-t border-secondary py-1">
            <span className="text-[12.5px] text-muted-foreground">{r.name}</span>
            <span className="tnum text-right text-[12.5px]">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="border-t px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
        If the price or the promotion moves, the snapshot stops matching and the banner expires on its own.
      </p>
    </div>
  );
}

/**
 * A banner costs a fraction of a cent in text, so dollars to two places would
 * read as zero. Cents with three decimals keeps the difference between a
 * cached run and a cold one visible, which is the point of showing it at all.
 */
function money(usd: number): string {
  const cents = usd * 100;
  return cents < 1 ? `${cents.toFixed(3)} cents` : `$${usd.toFixed(4)}`;
}

function ms(n: number): string {
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
