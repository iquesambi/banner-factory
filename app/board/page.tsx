'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, cn } from '@/components/ui/primitives';
import { BOARD_COLUMNS, LANGUAGE_LABEL, type Job, type Stage } from '@/app/lib/types';
import { BannerThumb } from '@/app/components/banner-thumb';
import { Thumbs } from '@/app/components/thumbs';

export default function BoardPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  /**
   * Polling, not pushing. The workflow already emits every stage and can POST
   * them to a webhook; the design has that landing in Firestore so the client
   * can listen. A one-second poll shows the same thing without standing up
   * Firebase, and the swap is one hook when it is there.
   */
  useEffect(() => {
    let live = true;
    const tick = () =>
      fetch('/api/jobs')
        .then((r) => r.json())
        .then((data: { jobs: Job[] }) => {
          if (live) setJobs(data.jobs);
        })
        .catch(() => undefined);
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  const rated = jobs?.filter((j) => j.rating) ?? [];
  const liked = rated.filter((j) => j.rating === 'up').length;

  return (
    <main className="w-full px-8 pb-14 pt-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Board</h1>
          <p className="text-[13.5px] text-muted-foreground">
            One card per banner. Cards move on their own as the workflow emits each stage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {rated.length > 0 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Rated by a person</div>
              <div className="tnum text-sm font-semibold">
                {rated.length} of {jobs?.length ?? 0} · {Math.round((liked / rated.length) * 100)}% liked
              </div>
            </div>
          )}
          <Link href="/">
            <Button>New banner</Button>
          </Link>
        </div>
      </div>

      {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}

      {jobs !== null && jobs.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing on the board yet.{' '}
            <Link href="/" className="font-medium text-foreground underline underline-offset-2">
              Queue a product
            </Link>{' '}
            to start.
          </p>
        </div>
      )}

      {jobs !== null && jobs.length > 0 && (
        <div className="flex items-start gap-3.5 overflow-x-auto pb-2">
          {BOARD_COLUMNS.map((col) => {
            const inColumn = jobs.filter((j) => inStage(j, col.stage));
            return (
              <section
                key={col.stage}
                className="flex min-w-[212px] flex-1 shrink-0 flex-col rounded-[11px] border bg-secondary/40"
              >
                <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: col.dot }} />
                  <h2 className="text-[12.5px] font-semibold text-slate-700">{col.title}</h2>
                  <div className="flex-grow" />
                  <span className="tnum text-[11.5px] text-muted-foreground">{inColumn.length}</span>
                </div>

                <div className="flex flex-col gap-2 px-2.5 pb-3">
                  {inColumn.map((job) => (
                    <JobCard key={job.id} job={job} onChange={(j) => setJobs((all) => all?.map((x) => (x.id === j.id ? j : x)) ?? null)} />
                  ))}
                  {inColumn.length === 0 && (
                    <div className="rounded-[9px] border border-dashed px-2.5 py-3.5 text-center text-[11.5px] text-muted-foreground">
                      nothing here
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

/** A failed job stays in the column it died in, so the failure has a place. */
function inStage(job: Job, stage: Stage): boolean {
  if (job.stage === stage) return true;
  if (job.stage !== 'failed') return false;
  const reached = job.pick ? (job.brief ? 'drawing' : 'writing') : 'choosing';
  return reached === stage;
}

function JobCard({ job, onChange }: { job: Job; onChange: (job: Job) => void }) {
  const failed = job.stage === 'failed';
  const running = ['choosing', 'writing', 'drawing'].includes(job.stage);
  const title = job.pick?.name ?? job.seed.name;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[9px] border bg-card',
        failed && 'border-orange-200',
        job.rating === 'up' && 'border-lime-300',
      )}
    >
      <Link href={`/board/${job.id}`} className="block">
        {job.png && <BannerThumb job={job} />}

        <div className="px-2.5 pb-2.5 pt-2.5">
          <div className="text-[12.5px] font-medium leading-snug">{title}</div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{LANGUAGE_LABEL[job.language]}</Badge>
            <span className="tnum text-[11px] text-muted-foreground">
              {job.cost.calls ? `${job.cost.calls} calls · ${job.cost.tokens.toLocaleString('en-GB')} tk` : 'not started'}
            </span>
            {running && <span className="text-[11px] text-elgi-navy">running…</span>}
            {failed && <Badge tone="amber">needs a look</Badge>}
          </div>

          {failed && job.error && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] text-orange-800">{job.error}</p>
          )}
        </div>
      </Link>

      {(job.stage === 'review' || job.stage === 'ready') && (
        <div className="border-t px-2.5 py-2">
          <Thumbs job={job} onChange={onChange} compact />
        </div>
      )}
    </article>
  );
}
