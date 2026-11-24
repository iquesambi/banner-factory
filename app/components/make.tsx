'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/primitives';
import { LANGUAGE_LABEL, type Job } from '@/app/lib/types';
import type { Language } from '@/src/banner/facts';

const ALL: Language[] = ['da', 'sv', 'en'];

/**
 * Asking for a banner whose product is already decided.
 *
 * Naming the product skips the matcher, and that is the point: "the same
 * banner, in Swedish" is a translation, and a run that was free to choose
 * again could come back with another product and would not be a translation
 * of anything.
 *
 * It is not free. The copy is written again and the layout drawn again,
 * because both depend on the language; only the choosing is skipped — unless
 * that exact banner already exists and still matches the feed, in which case
 * the run adopts it and costs nothing at all.
 */
async function ask(
  item: { sku: string; language: Language; pick: string; how: 'seed' | 'translation'; fromJobId: string },
): Promise<void> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [item] }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

/**
 * The same banner, in the languages it is not in yet.
 *
 * The market does not change — prices stay in kroner, because the feed is one
 * shop's — so this is the text in another language and nothing else.
 */
export function TranslateButtons({ job }: { job: Job }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = job.pick;
  if (!pick) return null;

  const others = ALL.filter((l) => l !== job.language);

  async function go(language: Language) {
    if (busy || !pick) return;
    setBusy(language);
    setError(null);
    try {
      await ask({
        sku: job.seed.sku,
        language,
        pick: pick.sku,
        how: 'translation',
        fromJobId: job.id,
      });
      router.push('/board');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12.5px] text-muted-foreground">Translate to</span>
      {others.map((l) => (
        <button
          key={l}
          type="button"
          disabled={busy !== null}
          onClick={(e) => { e.preventDefault(); void go(l); }}
          className="rounded-full border bg-card px-2.5 py-1 text-[12px] text-slate-700 hover:border-slate-400 disabled:opacity-60"
        >
          {busy === l ? 'queueing…' : LANGUAGE_LABEL[l]}
        </button>
      ))}
      {error && <span className="text-[11.5px] text-orange-800">{error}</span>}
    </div>
  );
}
