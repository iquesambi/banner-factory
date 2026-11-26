'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Putting a banner out, from the shelf it is sitting on.
 *
 * Publishing is the only thing on this page that changes what somebody
 * outside this machine can see, so it says which of the two states it is in
 * rather than only offering the next action: "published" with a dot that is
 * on, or "publish" as an invitation.
 *
 * It is one click, not two. Unlike the delete beside it, both directions are
 * reversible and nothing is lost by pressing it in error.
 */
export function PublishBanner({ jobId, published }: { jobId: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ published: !published }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <span className="text-[11.5px] text-orange-800">{error}</span>;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      title={published ? 'Take it back off the demo shop' : 'Put it on the demo shop'}
      className={
        published
          ? 'inline-flex items-center gap-1.5 rounded-md border border-lime-300 bg-lime-50 px-2.5 py-1 text-[12px] font-medium text-lime-900 disabled:opacity-60'
          : 'inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:border-slate-400 disabled:opacity-60'
      }
    >
      <span
        className={
          published ? 'h-[7px] w-[7px] rounded-full bg-lime-600' : 'h-[7px] w-[7px] rounded-full border border-slate-400'
        }
      />
      {busy ? 'saving…' : published ? 'Published' : 'Publish'}
    </button>
  );
}
