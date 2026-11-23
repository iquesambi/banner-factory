'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, cn } from '@/components/ui/primitives';
import { LANGUAGE_LABEL, kr, stockLabel, type Job } from '@/app/lib/types';
import { BannerThumb } from '@/app/components/banner-thumb';
import { Thumbs } from '@/app/components/thumbs';
import { PhotoBox } from '@/app/components/photo-box';
import { describe } from '@/app/lib/describe';

export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);

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
                label="THE SEED"
                name={job.seed.name}
                sku={job.seed.sku}
                price={job.seed.price}
                stock={job.seed.stockBand}
                image={job.seed.image}
                tone="muted"
              />
              <div className="flex shrink-0 items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-label="replaced by" role="img">
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
                  <li className="px-3.5 py-3 text-[12.5px] text-muted-foreground">waiting to start…</li>
                )}
              </ol>

              {job.pick && (
                <>
                  <h2 className="mb-2.5 text-sm font-semibold">Why this product</h2>
                  <div className="rounded-[10px] border px-4 py-3.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{job.pick.name}</span>
                      <span className="text-[12.5px] text-muted-foreground">
                        {kr(job.pick.price)}
                        {job.seed.price > 0 && (
                          <> · {Math.round(((job.pick.price - job.seed.price) / job.seed.price) * 100)}% against the seed</>
                        )}
                      </span>
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
                  <div className="flex items-baseline gap-1.5">
                    <span className="tnum text-[27px] font-semibold tracking-tight">
                      {job.cost.tokens.toLocaleString('en-GB')}
                    </span>
                    <span className="text-[13px] text-muted-foreground">tokens</span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">{job.cost.calls} model calls</div>
                </div>
                {job.cost.byStep.length > 0 && (
                  <div className="border-b px-3.5 py-2.5">
                    {job.cost.byStep.map((s) => (
                      <div key={s.name} className="flex items-baseline justify-between gap-2.5 py-0.5">
                        <span className="text-[12.5px] text-slate-600">{s.name}</span>
                        <span className="tnum whitespace-nowrap text-[12.5px]">
                          {s.calls} · {s.tokens.toLocaleString('en-GB')} tk
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-2.5 py-0.5 text-muted-foreground">
                      <span className="text-[12.5px]">Generating the image</span>
                      <span className="text-[12.5px]">—</span>
                    </div>
                  </div>
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
}: {
  label: string;
  name: string;
  sku: string;
  price: number;
  stock: string;
  image: string | null;
  tone: 'muted' | 'green';
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
        <div className="mt-0.5 text-[13px] font-medium leading-tight">{name}</div>
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

function ms(n: number): string {
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
