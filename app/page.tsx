'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Segmented } from '@/components/ui/primitives';
import { PhotoBox } from '@/app/components/photo-box';

type Language = 'da' | 'sv' | 'en';

interface Hit {
  sku: string;
  name: string;
  price: number;
  stockBand: string;
  image: string | null;
}

interface QueueItem {
  key: string;
  sku: string;
  name: string;
  image: string | null;
  language: Language;
}

const LANGUAGES = [
  { value: 'da' as const, label: 'Dansk' },
  { value: 'sv' as const, label: 'Svenska' },
  { value: 'en' as const, label: 'English' },
];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [language, setLanguage] = useState<Language>('da');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * One request in flight at a time, and the last one wins. Typing quickly
   * otherwise paints an older result over a newer one.
   */
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { hits: Hit[]; total: number }) => {
          if (ticket !== latest.current) return;
          setHits(data.hits);
          setTotal(data.total);
        })
        .catch(() => undefined);
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  function add(hit: Hit) {
    setQueue((q) => {
      if (q.some((i) => i.sku === hit.sku && i.language === language)) return q;
      return [...q, { key: `${hit.sku}-${language}`, sku: hit.sku, name: hit.name, image: hit.image, language }];
    });
  }

  /**
   * Changing a card's language keeps its place in the queue, and refuses the
   * change when the same product is already queued in that language — two
   * identical cards would produce two identical banners.
   */
  function retarget(key: string, language: Language) {
    setQueue((q) => {
      const item = q.find((i) => i.key === key);
      if (!item) return q;
      const clash = q.some((i) => i.key !== key && i.sku === item.sku && i.language === language);
      if (clash) return q;
      return q.map((i) => (i.key === key ? { ...i, language, key: `${i.sku}-${language}` } : i));
    });
  }

  async function generate() {
    if (!queue.length || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: queue.map((i) => ({ sku: i.sku, language: i.language })) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push('/board');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  }

  const queued = (sku: string) => queue.some((i) => i.sku === sku && i.language === language);

  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-8 pb-12 pt-6">
      <div className="flex w-full max-w-[660px] flex-col items-center">
        <h1 className="mb-7 text-center text-[25px] font-medium tracking-tight">
          Which products was the customer looking at?
        </h1>

        {queue.length > 0 && (
          <div className="mb-6 w-full">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {queue.length} in the queue
              </span>
              <button
                type="button"
                onClick={() => setQueue([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {queue.map((item) => (
                <li
                  key={item.key}
                  className="flex min-w-[190px] flex-1 items-center gap-2.5 rounded-[10px] border bg-card p-2"
                >
                  <PhotoBox src={item.image} alt="" className="h-[38px] w-[38px]" />
                  <div className="min-w-0 flex-grow">
                    <div className="text-[12.5px] font-medium leading-tight">{item.name}</div>
                    <label className="sr-only" htmlFor={`lang-${item.key}`}>
                      Language for {item.name}
                    </label>
                    <select
                      id={`lang-${item.key}`}
                      value={item.language}
                      onChange={(e) => retarget(item.key, e.target.value as Language)}
                      className="mt-1 rounded border bg-secondary px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name} from the queue`}
                    onClick={() => setQueue((q) => q.filter((i) => i.key !== item.key))}
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="w-full overflow-hidden rounded-[26px] border border-input bg-card shadow-[0_2px_10px_rgba(15,23,42,0.07)]">
          <div className="flex h-[52px] items-center gap-3 px-5">
            <SearchIcon />
            <label htmlFor="search" className="sr-only">
              Search by product name or SKU
            </label>
            <input
              id="search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product name or SKU"
              className="h-full flex-grow bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          {hits.length > 0 && (
            <ul role="listbox" aria-label="Suggestions" className="border-t py-1.5">
              {hits.map((hit) => (
                <li key={hit.sku} role="option" aria-selected={queued(hit.sku)}>
                  <button
                    type="button"
                    onClick={() => add(hit)}
                    className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-secondary/60"
                  >
                    <PhotoBox src={hit.image} alt="" className="h-9 w-9" />
                    <span className="min-w-0 flex-grow text-[14.5px] leading-tight">{hit.name}</span>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">{hit.sku}</span>
                    {queued(hit.sku) && (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-label="in the queue" role="img">
                        <path d="M3 8.4l3.2 3.2L13 5" stroke="#4d7d14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Segmented options={LANGUAGES} value={language} onChange={setLanguage} label="Language for what you add next" />
          <Button onClick={generate} disabled={!queue.length || sending}>
            {sending ? 'Starting…' : 'Generate now'}
            {queue.length > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{queue.length}</span>
            )}
          </Button>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <p className="mt-3.5 text-center text-[12.5px] text-muted-foreground">
          Pick the language first; it is stored on each card, so the same product can sit in the queue twice.
        </p>
      </div>

      <footer className="pt-10 text-center text-[12.5px] text-muted-foreground">
        Name and SKU, matched anywhere in the string
        {total !== null && `, over ${total.toLocaleString('en-GB')} products held in memory`}
      </footer>
    </main>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="9" cy="9" r="6.25" stroke="#94a3b8" strokeWidth="1.7" />
      <path d="M13.6 13.6L17.5 17.5" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
