'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, cn } from '@/components/ui/primitives';
import {
  BOARD_COLUMNS, LANGUAGE_LABEL, REDO_STAGES,
  allGood, anyVerdict, type Job, type Stage,
} from '@/app/lib/types';
import { BannerThumb } from '@/app/components/banner-thumb';

/** The order the work happens in, for deciding what counts as backwards. */
const ORDER: Stage[] = ['queued', 'choosing', 'writing', 'drawing', 'ready'];
const positionOf = (job: Job) => {
  if (job.stage === 'failed') return ORDER.indexOf(job.png ? 'drawing' : job.pick ? 'writing' : 'choosing');
  if (job.stage === 'review') return ORDER.indexOf('ready');
  return ORDER.indexOf(job.stage);
};

export default function BoardPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  /** The card being dragged, and the column it is over. */
  const [held, setHeld] = useState<Job | null>(null);
  const [overColumn, setOverColumn] = useState<Stage | null>(null);
  const [redoing, setRedoing] = useState<string | null>(null);

  /**
   * Dragging a card back a column is how a person disagrees with what that
   * stage produced. Only backwards: dragging forward would mean skipping
   * work, and there is nothing a person can contribute by doing that.
   */
  async function redo(job: Job, to: Stage) {
    if (!REDO_STAGES.includes(to)) return;
    if (positionOf(job) <= ORDER.indexOf(to)) return;
    setRedoing(job.id);
    try {
      await fetch(`/api/jobs/${job.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from: to }),
      });
    } finally {
      setRedoing(null);
    }
  }

  async function remove(job: Job) {
    setJobs((all) => all?.filter((j) => j.id !== job.id) ?? null);
    await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' }).catch(() => undefined);
  }

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

  const rated = jobs?.filter((j) => anyVerdict(j.verdicts)) ?? [];
  const liked = rated.filter((j) => allGood(j.verdicts)).length;

  return (
    /*
      The page fills the window and stops there. The board below takes
      whatever the header leaves, measured by the browser rather than by a
      magic number, so a header that wraps at a narrow width does not push
      the columns off the bottom.
    */
    <main className="flex h-[calc(100vh-60px)] w-full flex-col px-8 pb-6 pt-5">
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
        <div className="flex min-h-[260px] flex-1 items-stretch gap-3.5 overflow-x-auto overflow-y-hidden pb-2">
          {/*
            The board is as tall as the window and never taller. Columns used
            to grow with their contents, so one busy column pushed the page
            down and the other four became headers floating above empty space
            you had to scroll past. Each keeps its own scroll now, and every
            column header stays put.
          */}
          {BOARD_COLUMNS.map((col) => {
            const inColumn = jobs.filter((j) => inStage(j, col.stage));
            /** Counted after grouping, so the number matches the cards shown. */
            const groups = group(inColumn);
            const canDrop =
              held !== null
              && REDO_STAGES.includes(col.stage)
              && positionOf(held) > ORDER.indexOf(col.stage);
            return (
              <section
                key={col.stage}
                onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOverColumn(col.stage); } }}
                onDragLeave={() => setOverColumn((c) => (c === col.stage ? null : c))}
                onDrop={() => {
                  const job = held;
                  setOverColumn(null);
                  setHeld(null);
                  if (job && canDrop) void redo(job, col.stage);
                }}
                className={cn(
                  'flex min-w-[212px] flex-1 shrink-0 flex-col overflow-hidden rounded-[11px] border bg-secondary/40',
                  canDrop && 'border-dashed border-elgi-navy/50',
                  overColumn === col.stage && canDrop && 'border-solid border-elgi-navy bg-blue-50/60',
                )}
              >
                <div className="flex shrink-0 items-center gap-2 px-3.5 pb-2 pt-3">
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: col.dot }} />
                  <h2 className="text-[12.5px] font-semibold text-slate-700">{col.title}</h2>
                  <div className="flex-grow" />
                  <span className="tnum text-[11.5px] text-muted-foreground">{groups.length}</span>
                </div>


                <div className="flex min-h-0 flex-grow flex-col gap-2 overflow-y-auto px-2.5 pb-3">
                  {groups.map((g) => (
                    <JobCard
                      key={g.primary.id}
                      job={g.primary}
                      alsoFrom={g.alsoFrom}
                      busy={redoing === g.primary.id}
                      onPickUp={setHeld}
                      onDelete={remove}
                    />
                  ))}
                  {groups.length === 0 && (
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

/**
 * One card per banner, not per request.
 *
 * Asking for the same banner twice produces two jobs, and the second one
 * reuses the first one's image. Showing both would be two cards of the same
 * picture, and only one of them is the job that made it. They collapse into
 * the card for the job that did the work, and the others become a line
 * saying which seeds also landed here.
 */
interface Group {
  primary: Job;
  alsoFrom: Job[];
}

function group(jobs: Job[]): Group[] {
  const byBanner = new Map<string, Job[]>();
  for (const job of jobs) {
    /** No image yet means nothing to share: it stands on its own. */
    const key = job.png ?? `job:${job.id}`;
    const list = byBanner.get(key);
    if (list) list.push(job);
    else byBanner.set(key, [job]);
  }

  return [...byBanner.values()].map((list) => {
    const made = list.filter((j) => !j.reuse);
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const primary = made[0] ?? sorted[0]!;
    return { primary, alsoFrom: list.filter((j) => j.id !== primary.id) };
  });
}

/**
 * Money on the card, tokens only when there is no rate for the model.
 * A banner costs a fraction of a cent, so cents with two decimals is the
 * unit that still shows the difference between a cached run and a cold one.
 */
function cents(cost: Job['cost']): string {
  if (cost.usd === null) return cost.tokens ? `${cost.tokens.toLocaleString('en-GB')} tk` : 'free';
  const c = cost.usd * 100;
  // Spelled out rather than the cent sign: in this UI's font that glyph reads
  // as a struck-through letter instead of a currency mark. The banner card
  // already says "cents", so the two views now agree.
  return c < 1 ? `${c.toFixed(2)} cents` : `$${cost.usd.toFixed(3)}`;
}

/** A failed job stays in the column it died in, so the failure has a place. */
function inStage(job: Job, stage: Stage): boolean {
  // `review` is no longer a column; a banner that exists is ready, and the
  // thumbs on the card are the review. Old files still say review.
  if (stage === 'ready' && job.stage === 'review') return true;
  if (job.stage === stage) return true;
  if (job.stage !== 'failed') return false;
  const reached = job.pick ? (job.brief ? 'drawing' : 'writing') : 'choosing';
  return reached === stage;
}

function JobCard({
  job,
  alsoFrom,
  busy,
  onPickUp,
  onDelete,
}: {
  job: Job;
  alsoFrom: Job[];
  busy: boolean;
  onPickUp: (job: Job | null) => void;
  onDelete: (job: Job) => void;
}) {
  const failed = job.stage === 'failed';
  const running = ['choosing', 'writing', 'drawing'].includes(job.stage);
  const title = job.pick?.name ?? job.seed.name;
  /**
   * A card that will never move on its own is one a person may throw away.
   * A running one is not draggable either: it is mid-flight, and asking for
   * a stage again while that stage is happening is a race, not an opinion.
   */
  const stuck = failed || job.stage === 'queued';

  return (
    <article
      draggable={!running && !busy}
      onDragStart={() => onPickUp(job)}
      onDragEnd={() => onPickUp(null)}
      className={cn(
        // shrink-0 or the column squashes its cards instead of scrolling:
        // a flex child gives up its height before the parent overflows, so
        // five cards were being crushed into 28px each.
        'group relative shrink-0 overflow-hidden rounded-[9px] border bg-card',
        !running && !busy && 'cursor-grab active:cursor-grabbing',
        failed && 'border-orange-200',
        busy && 'opacity-60',
      )}
    >
      {stuck && (
        <button
          type="button"
          title="Throw this card away"
          onClick={(e) => { e.preventDefault(); onDelete(job); }}
          className="absolute right-1.5 top-1.5 z-10 hidden h-5 w-5 items-center justify-center rounded bg-card/90 text-[13px] leading-none text-muted-foreground hover:text-orange-800 group-hover:flex"
        >
          ×
        </button>
      )}
      <Link href={`/board/${job.id}`} className="block">
        {job.png && <BannerThumb job={job} />}

        <div className="px-2.5 pb-2.5 pt-2.5">
          <div className="text-[12.5px] font-medium leading-snug">{title}</div>
          {/*
            Who it was aimed at, on the card itself. The board is where a
            person will eventually sit and rate these, and "is this a good
            banner" is unanswerable without knowing who it was for.
          */}
          {job.audience?.cluster && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              for the {job.audience.cluster.label.toLowerCase()}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{LANGUAGE_LABEL[job.language]}</Badge>
            <span className="tnum text-[11px] text-muted-foreground">
              {job.reuse
                ? 'reused · free'
                : job.cost.calls
                  ? `${job.cost.calls} calls · ${cents(job.cost)}`
                  : 'not started'}
            </span>
            {(running || busy) && (
              <span className="text-[11px] text-elgi-navy">{busy ? 'redoing…' : 'running…'}</span>
            )}
            {failed && <Badge tone="amber">needs a look</Badge>}
            {job.reuse && <Badge tone="green">reused</Badge>}
          </div>

          {failed && job.error && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] text-orange-800">{job.error}</p>
          )}

          {alsoFrom.length > 0 && (
            <p className="mt-1.5 text-[11px] text-lime-700">
              Also asked for from {alsoFrom.length} other {alsoFrom.length === 1 ? 'seed' : 'seeds'}, reused
              both times
            </p>
          )}
        </div>
      </Link>

    </article>
  );
}
