'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Throwing a banner away, from the shelf it is sitting on.
 *
 * Two clicks, not a dialog. A confirm box would be dismissed without being
 * read; a button that changes into "Delete it?" and back out again after a
 * few seconds says the same thing in the place the eye already is.
 *
 * It says how many runs go with the picture before it goes, because a banner
 * reused three times is three cards disappearing, and nobody expects that
 * from one delete.
 */
export function DeleteBanner({ png, alsoFrom }: { png: string; alsoFrom: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/banners/${encodeURIComponent(png)}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setArmed(false);
    }
  }

  if (error) {
    return <span className="text-[11.5px] text-orange-800">{error}</span>;
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(true);
          /** Disarms itself: a delete button left cocked is a trap. */
          setTimeout(() => setArmed(false), 4000);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
      >
        <TrashIcon />
        Delete banner
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className="rounded-md border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11.5px] font-medium text-orange-900 disabled:opacity-60"
      >
        {busy ? 'Deleting…' : alsoFrom > 0 ? `Delete it and ${alsoFrom + 1} runs` : 'Delete it'}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-[11.5px] text-muted-foreground underline underline-offset-2"
      >
        Keep
      </button>
    </span>
  );
}

/**
 * A bin, 13px. The word alone was too quiet to find — the shape is what the
 * eye scans a card footer for.
 */
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
    </svg>
  );
}
