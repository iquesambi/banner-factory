'use client';

import { useState } from 'react';
import { cn } from '@/components/ui/primitives';
import { DISLIKE_REASONS, type Job } from '@/app/lib/types';

/**
 * The rating control.
 *
 * The rating is stored on the job, which already holds the seed, the chosen
 * product, the copy, the badges and the layout. That is the point: the
 * judgement is kept next to the brief that produced it, so the set can be
 * used to fine-tune later rather than being a score with no context.
 *
 * A thumb down asks for one word on why, because a negative with no reason
 * tells a future training run almost nothing.
 */
export function Thumbs({
  job,
  onChange,
  compact = false,
}: {
  job: Job;
  onChange: (job: Job) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  async function send(rating: 'up' | 'down' | null, reason: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, reason }),
      });
      if (res.ok) {
        const data = (await res.json()) as { job: Job };
        onChange(data.job);
      }
    } finally {
      setBusy(false);
    }
  }

  const size = compact ? 'px-2 py-1 text-[11px]' : 'px-4 py-2 text-[13px]';

  return (
    <div className={compact ? '' : 'rounded-[11px] border border-lime-200 bg-lime-50/60 p-4'}>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-[230px] flex-grow">
            <div className="text-[13.5px] font-semibold text-lime-800">Is this a good banner?</div>
            <div className="mt-0.5 text-[12.5px] text-lime-700">
              Saved with the whole brief, so the set can fine-tune the models later.
            </div>
          </div>
          <Buttons />
        </div>
      )}

      {compact && <Buttons />}

      {(asking || job.rating === 'down') && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5',
            compact ? 'mt-2' : 'mt-3 border-t border-lime-200 pt-3',
          )}
        >
          {!compact && <span className="mr-0.5 text-xs text-lime-700">What was wrong?</span>}
          {DISLIKE_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                void send('down', reason);
                setAsking(false);
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                job.ratingReason === reason
                  ? 'border-orange-300 bg-orange-100 text-orange-900'
                  : 'border-input bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {reason}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  function Buttons() {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Good banner"
          aria-pressed={job.rating === 'up'}
          disabled={busy}
          onClick={() => void send(job.rating === 'up' ? null : 'up', null)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors',
            size,
            job.rating === 'up'
              ? 'border-lime-600 bg-lime-600 text-white'
              : 'border-input bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          <ThumbIcon />
          {compact ? '' : 'Good'}
        </button>
        <button
          type="button"
          aria-label="Poor banner"
          aria-pressed={job.rating === 'down'}
          disabled={busy}
          onClick={() => {
            if (job.rating === 'down') void send(null, null);
            else setAsking(true);
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors',
            size,
            job.rating === 'down'
              ? 'border-orange-300 bg-orange-100 text-orange-900'
              : 'border-input bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          <ThumbIcon down />
          {compact ? '' : 'Poor'}
        </button>
        {compact && job.ratingReason && (
          <span className="truncate text-[10.5px] text-orange-800">{job.ratingReason}</span>
        )}
      </div>
    );
  }
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
