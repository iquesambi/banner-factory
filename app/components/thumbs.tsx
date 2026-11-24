'use client';

import { useState } from 'react';
import { cn } from '@/components/ui/primitives';
import {
  VERDICT_BY_AGENT, VERDICT_LABEL, VERDICT_STAGES,
  type Job, type VerdictStage,
} from '@/app/lib/types';
import { useAuth } from '@/app/lib/auth';
import { authHeaders, useProfile } from '@/app/lib/profile';
import { whyNot } from '@/src/auth/roles';
import { saveReview } from '@/app/lib/reviews';

/**
 * Three verdicts, because a banner is three judgements.
 *
 * It was one thumb, and one thumb could not say what was wrong. The product
 * can be right and the copy wrong; the copy can be right and the layout
 * broken — and each of those comes from a different agent, so a verdict that
 * does not name the stage cannot improve anyone's prompt.
 *
 * Binary on purpose. These are read later to fix prompts, and a prompt can
 * absorb "the product was wrong"; it cannot absorb a 3 out of 5.
 *
 * Nothing here blocks anything. Being unhappy with the copy and publishing
 * the banner anyway is an ordinary decision, so a thumb down moves no card
 * and stops no button.
 */
export function Thumbs({
  job,
  onChange,
}: {
  job: Job;
  onChange: (job: Job) => void;
}) {
  const { user } = useAuth();
  const { me } = useProfile();
  const [busy, setBusy] = useState<VerdictStage | null>(null);
  const [refused, setRefused] = useState<string | null>(null);

  /**
   * What this person's craft is. The server decides it and checks it again;
   * this only saves somebody the click and the refusal.
   */
  const mayJudge = (stage: VerdictStage) =>
    !me ? false : me.unverified ? true : me.judges.includes(stage);

  async function send(stage: VerdictStage, value: 'up' | 'down' | null) {
    if (busy) return;
    setBusy(stage);
    setRefused(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        /**
         * No author in the body. Who is speaking is proved by the token in
         * the header; a name posted here would be whatever the browser felt
         * like saying.
         */
        body: JSON.stringify({ stage, value }),
      });
      if (res.ok) {
        onChange(((await res.json()) as { job: Job }).job);
        /** The attributed copy, for the set that will train on this later. */
        void saveReview(user?.uid ?? null, job.id, value, stage, job.storage?.path ?? null);
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRefused(body.error ?? `could not record that (HTTP ${res.status})`);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[11px] border border-lime-200 bg-lime-50/60 p-4">
      <div className="mb-0.5 text-[13.5px] font-semibold text-lime-800">
        What worked, and what did not?
      </div>
      <div className="mb-3 text-[12.5px] leading-relaxed text-lime-700">
        Each answer is kept with the whole brief and with whichever agent produced it, so the set
        can be read later to fix their instructions. Saying no here changes nothing about this
        banner — publish it anyway if it is good enough.
      </div>

      <div className="flex flex-col gap-1.5">
        {VERDICT_STAGES.map((stage) => {
          const mine = mayJudge(stage);
          return (
            <div
              key={stage}
              className={cn(
                'flex flex-wrap items-center gap-2.5 rounded-[9px] px-3 py-2',
                mine ? 'bg-card/70' : 'bg-card/30',
              )}
            >
              <div className="min-w-[150px] flex-grow">
                <div className={cn('text-[13px] font-medium', !mine && 'text-muted-foreground')}>
                  {VERDICT_LABEL[stage]}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {mine ? VERDICT_BY_AGENT[stage] : whyNot(me?.role ?? null, stage)}
                </div>
              </div>
              {/*
                No buttons at all when it is not your craft.
                A faded, unclickable thumb still reads as something to press,
                and it invites exactly the judgement this is meant to keep
                out. What somebody else already decided is still shown —
                that is the state of the banner, and everyone needs to see
                it — but as a mark, not as a control.
              */}
              {mine ? (
                <StageMark job={job} stage={stage} busy={busy === stage} onSend={send} />
              ) : (
                <ReadOnlyMark job={job} stage={stage} />
              )}
            </div>
          );
        })}
      </div>

      {refused && <p className="mt-2 text-[12px] text-orange-800">{refused}</p>}
    </div>
  );
}

/** Somebody else's verdict, or nothing yet. Never a button. */
function ReadOnlyMark({ job, stage }: { job: Job; stage: VerdictStage }) {
  const verdict = job.verdicts[stage];
  if (!verdict) {
    return <span className="text-[11.5px] text-muted-foreground">not judged yet</span>;
  }
  return (
    <span
      className={cn(
        'rounded-md border px-2.5 py-1 text-[11.5px]',
        verdict.value === 'up'
          ? 'border-lime-300 bg-lime-50 text-lime-800'
          : 'border-orange-200 bg-orange-50 text-orange-900',
      )}
    >
      {verdict.value === 'up' ? 'good' : 'poor'}
      {verdict.source === 'redo' && ' · from a redo'}
      {verdict.by && ` · ${verdict.by}`}
    </span>
  );
}

function StageMark({
  job,
  stage,
  busy,
  onSend,
}: {
  job: Job;
  stage: VerdictStage;
  busy: boolean;
  onSend: (stage: VerdictStage, value: 'up' | 'down' | null) => void;
}) {
  const verdict = job.verdicts[stage];

  /**
   * A verdict that came from dragging the card back is shown as what it is.
   * Someone paid to redo that stage, which is a stronger statement than a
   * click, and hiding the difference would make the two look the same.
   */
  const fromRedo = verdict?.source === 'redo';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`${VERDICT_LABEL[stage]}: good`}
        aria-pressed={verdict?.value === 'up'}
        disabled={busy}
        onClick={() => onSend(stage, verdict?.value === 'up' ? null : 'up')}
        className={cn(
          'inline-flex h-8 items-center justify-center rounded-md border px-3 transition-colors',
          verdict?.value === 'up'
            ? 'border-lime-600 bg-lime-600 text-white'
            : 'border-input bg-background text-muted-foreground hover:text-foreground',
        )}
      >
        <ThumbIcon />
      </button>
      <button
        type="button"
        aria-label={`${VERDICT_LABEL[stage]}: poor`}
        aria-pressed={verdict?.value === 'down'}
        disabled={busy}
        onClick={() => onSend(stage, verdict?.value === 'down' ? null : 'down')}
        className={cn(
          'inline-flex h-8 items-center justify-center rounded-md border px-3 transition-colors',
          verdict?.value === 'down'
            ? 'border-orange-300 bg-orange-100 text-orange-900'
            : 'border-input bg-background text-muted-foreground hover:text-foreground',
        )}
      >
        <ThumbIcon down />
      </button>
      {fromRedo && (
        <span className="ml-1 text-[11px] text-orange-800">from a redo</span>
      )}
    </div>
  );
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={down ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path
        d="M5 14V7l3.2-5a1.6 1.6 0 0 1 2.4 1.9L9.8 6.5H13a1.5 1.5 0 0 1 1.45 1.9l-1.3 4.6A1.5 1.5 0 0 1 11.7 14H5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2 7h3v7H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
