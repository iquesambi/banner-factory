'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, Button, cn } from '@/components/ui/primitives';
import type { Policy, Rule } from '@/src/policy/index';
import type { ReuseRules } from '@/app/lib/rules';

interface PolicyPayload {
  policy: Policy;
  stale: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

const newRule = (): Rule => ({
  id: Math.random().toString(36).slice(2, 10),
  text: '',
  enabled: true,
});

export default function RulesPage() {
  const [data, setData] = useState<PolicyPayload | null>(null);
  const [reuse, setReuse] = useState<ReuseRules | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | 'saving' | 'compiling'>(null);
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/policy').then((r) => r.json()).then(setData).catch(() => undefined);
    fetch('/api/rules').then((r) => r.json()).then((d) => setReuse(d.rules)).catch(() => undefined);
  }, []);

  const rules = data?.policy.rules ?? [];

  function edit(next: Rule[]) {
    if (!data) return;
    setData({ ...data, policy: { ...data.policy, rules: next } });
    setDirty(true);
  }

  async function save(): Promise<Policy | null> {
    if (!data) return null;
    setBusy('saving');
    setError(null);
    try {
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ policy: data.policy }),
      });
      const next = (await res.json()) as PolicyPayload;
      setData(next);
      setDirty(false);
      return next.policy;
    } finally {
      setBusy(null);
    }
  }

  /** Saving first, always: the compiler reads what is on disk, not the screen. */
  async function compile() {
    if (dirty) await save();
    setBusy('compiling');
    setError(null);
    try {
      const res = await fetch('/api/policy', { method: 'POST' });
      const next = (await res.json()) as PolicyPayload;
      if (next.error) setError(next.error);
      else setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The compiler could not be reached.');
    } finally {
      setBusy(null);
    }
  }

  async function saveReuse(next: ReuseRules) {
    setReuse(next);
    await fetch('/api/rules', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rules: next }),
    }).catch(() => undefined);
  }

  function drop(to: number) {
    const from = dragging.current;
    dragging.current = null;
    setOver(null);
    if (from === null || from === to) return;
    const next = [...rules];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    edit(next);
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-[1100px] px-8 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const compiled = data.policy.compiled;

  return (
    <main className="mx-auto max-w-[1100px] px-8 pb-20 pt-5">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Business rules</h1>
      <p className="mb-6 max-w-[660px] text-[13.5px] leading-relaxed text-muted-foreground">
        Write a rule as a sentence. Nothing here is parsed or matched — the order is the only
        structure, and a rule above outranks a rule below it. One agent reads the list and writes
        the policy; another applies that policy to whatever a run offers, in stock or out.
      </p>

      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[999_1_540px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">The rules, most important first</h2>
            <span className="text-[12px] text-muted-foreground">drag to reorder</span>
            <div className="flex-grow" />
            <Button variant="outline" onClick={() => edit([...rules, newRule()])}>
              Add a rule
            </Button>
          </div>

          <ol className="mb-4 flex flex-col gap-2">
            {rules.map((rule, i) => (
              <li
                key={rule.id}
                draggable
                onDragStart={() => { dragging.current = i; }}
                onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={() => drop(i)}
                onDragEnd={() => { dragging.current = null; setOver(null); }}
                className={cn(
                  'flex items-start gap-2.5 rounded-[10px] border bg-card px-3 py-2.5',
                  over === i && 'border-elgi-navy bg-blue-50/50',
                  !rule.enabled && 'opacity-55',
                )}
              >
                <span
                  aria-hidden="true"
                  title="Drag to reorder"
                  className="mt-[7px] cursor-grab select-none text-[13px] leading-none text-muted-foreground active:cursor-grabbing"
                >
                  ⠿
                </span>
                <span className="tnum mt-[5px] w-[18px] shrink-0 text-right text-[12px] font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <textarea
                  value={rule.text}
                  rows={2}
                  placeholder="Write the rule as you would say it to a colleague."
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...rule, text: e.target.value };
                    edit(next);
                  }}
                  className="min-h-[46px] flex-grow resize-y rounded-md border-0 bg-transparent py-1 text-[13px] leading-relaxed outline-none"
                />
                <div className="mt-1 flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={rule.enabled}
                    title={rule.enabled ? 'Switch this rule off' : 'Switch this rule on'}
                    onClick={() => {
                      const next = [...rules];
                      next[i] = { ...rule, enabled: !rule.enabled };
                      edit(next);
                    }}
                    className={cn(
                      'rounded px-2 py-1 text-[11px] font-medium',
                      rule.enabled ? 'bg-lime-100 text-lime-800' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {rule.enabled ? 'on' : 'off'}
                  </button>
                  <button
                    type="button"
                    title="Remove this rule"
                    onClick={() => edit(rules.filter((_, j) => j !== i))}
                    className="rounded px-1.5 py-1 text-[13px] text-muted-foreground hover:text-orange-800"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
            {rules.length === 0 && (
              <li className="rounded-[10px] border border-dashed px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                No rules yet. Without them every run keeps the recommender&rsquo;s own ranking.
              </li>
            )}
          </ol>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={() => void save()} disabled={!dirty || busy !== null}>
              {busy === 'saving' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </Button>
            <Button variant="outline" onClick={() => void compile()} disabled={busy !== null}>
              {busy === 'compiling' ? 'Compiling…' : 'Compile the policy'}
            </Button>
            {data.stale && (
              <Badge tone="amber">
                {compiled ? 'the rules changed since the last compile' : 'never compiled'}
              </Badge>
            )}
            <span className="text-[11.5px] text-muted-foreground">version {data.policy.version}</span>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-orange-800">{error}</p>
          )}

          {data.stale && (
            <p className="mt-3 max-w-[560px] text-[12.5px] leading-relaxed text-muted-foreground">
              A run will not use a policy compiled from older rules — it would read like these rules
              and act like the previous ones. Until it is compiled again, runs keep the
              recommender&rsquo;s own ranking and say so on the card.
            </p>
          )}

          {/*
            These two are not written rules and are not pretending to be. They
            decide whether a run happens at all, which is settled before there
            are any candidates for a policy to choose between.
          */}
          {reuse && (
            <div className="mt-8 rounded-[11px] border bg-secondary/40 px-4 py-3.5">
              <h2 className="text-[13px] font-semibold">Before any of that: reuse</h2>
              <p className="mb-3 mt-0.5 max-w-[560px] text-[12.5px] leading-relaxed text-muted-foreground">
                Not written rules. These decide whether a banner is made at all, which happens
                before there is anything for a policy to choose between — and before any model is
                paid.
              </p>
              <label className="flex items-center gap-2.5 py-1 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={reuse.reuseSeed}
                  onChange={(e) => void saveReuse({ ...reuse, reuseSeed: e.target.checked })}
                />
                Reuse a banner already made from the same seed, if every fact on it still holds
              </label>
              <label className="flex flex-wrap items-center gap-2.5 py-1 text-[12.5px]">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={reuse.reuseDepth}
                  onChange={(e) => void saveReuse({ ...reuse, reuseDepth: Number(e.target.value) })}
                  className="h-7 w-[58px] rounded border bg-background px-2 text-[12.5px]"
                />
                Reuse a banner from the recommender&rsquo;s list down to this position
                <span className="text-muted-foreground">(0 switches it off)</span>
              </label>
            </div>
          )}
        </section>

        <aside className="min-w-[300px] flex-[1_1_320px]">
          <h2 className="mb-2.5 text-sm font-semibold">The policy the judge receives</h2>
          {!compiled && (
            <div className="rounded-[10px] border border-dashed px-4 py-6 text-[12.5px] leading-relaxed text-muted-foreground">
              Nothing compiled yet. Press <strong className="font-medium">Compile the policy</strong>{' '}
              to turn the rules above into the instructions the judge will follow.
            </div>
          )}
          {compiled && (
            <div className="overflow-hidden rounded-[10px] border">
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap border-b bg-card px-3.5 py-3 font-sans text-[12.5px] leading-relaxed">
                {compiled.policy}
              </pre>

              {compiled.conflicts.length > 0 && (
                <div className="border-b px-3.5 py-3">
                  <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Rules that can disagree
                  </div>
                  <ul className="flex list-inside list-disc flex-col gap-1 text-[12.5px] leading-snug text-slate-700">
                    {compiled.conflicts.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}

              {compiled.unusable.length > 0 && (
                <div className="border-b bg-orange-50/60 px-3.5 py-3">
                  <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-orange-800">
                    Cannot be checked from a candidate
                  </div>
                  <ul className="flex list-inside list-disc flex-col gap-1 text-[12.5px] leading-snug text-orange-900">
                    {compiled.unusable.map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </div>
              )}

              <div className="px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
                compiled from version {compiled.fromVersion} by {compiled.model}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
