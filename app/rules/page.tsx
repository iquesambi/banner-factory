'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, cn } from '@/components/ui/primitives';
import type { FunnelStep, RuleSet } from '@/app/lib/rules';

interface Rehearsal {
  seed: { sku: string; name: string; price: number; tier: number | null; stockBand: string };
  funnel: FunnelStep[];
  lastSurvivors: Array<{ sku: string; name: string; price: number; stockBand: string; dropped: boolean }>;
  left: number;
}

interface Payload {
  rules: RuleSet;
  prompt: string;
  rehearsals: Rehearsal[];
}

export default function RulesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/rules')
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);

  /** Rehearsing runs the filter lane on the server without saving anything. */
  const rehearse = useCallback(async (rules: RuleSet) => {
    setBusy(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      const next = (await res.json()) as Omit<Payload, 'rules'>;
      setData((d) => (d ? { ...d, ...next } : d));
    } finally {
      setBusy(false);
    }
  }, []);

  function change(rules: RuleSet) {
    setData((d) => (d ? { ...d, rules } : d));
    setDirty(true);
    void rehearse(rules);
  }

  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules: data.rules }),
      });
      setData((await res.json()) as Payload);
      setDirty(false);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-[1320px] px-8 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const { rules, prompt, rehearsals } = data;
  const lab = rehearsals[active];

  return (
    <main className="mx-auto max-w-[1320px] px-8 pb-16 pt-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Business rules</h1>
          <p className="text-[13.5px] text-muted-foreground">
            What must be true runs in code. What needs judgement becomes prompt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-muted-foreground">
            v{rules.version}
            {dirty && ' · unsaved'}
          </span>
          <Button onClick={save} disabled={!dirty || busy}>
            {busy ? 'Working…' : `Save as v${rules.version + 1}`}
          </Button>
        </div>
      </div>

      <div className="mb-7 flex flex-wrap items-stretch gap-4">
        <Column number="1" title="Filter" where="runs in code, before the model" nature="admits no disobedience" tone="navy">
          {rules.filter.map((f) => (
            <label
              key={f.id}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-[9px] border bg-card px-3 py-2.5',
                f.enabled && !f.required && 'border-slate-300',
              )}
            >
              <input
                type="checkbox"
                checked={f.enabled}
                disabled={f.required}
                onChange={(e) =>
                  change({
                    ...rules,
                    filter: rules.filter.map((x) => (x.id === f.id ? { ...x, enabled: e.target.checked } : x)),
                  })
                }
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#0e2d7c]"
              />
              <span className="min-w-0 flex-grow">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium">{f.label}</span>
                  {f.required && <Badge>required</Badge>}
                </span>
                {f.value !== undefined && f.enabled && (
                  <input
                    value={f.value}
                    onChange={(e) =>
                      change({
                        ...rules,
                        filter: rules.filter.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)),
                      })
                    }
                    className="mt-1.5 w-24 rounded border px-1.5 py-0.5 text-xs"
                    aria-label={`${f.label} value`}
                  />
                )}
                {f.note && <span className="mt-0.5 block text-xs text-muted-foreground">{f.note}</span>}
              </span>
            </label>
          ))}
        </Column>

        <Column number="2" title="Choose" where="becomes prompt, the model judges" nature="admits interpretation" tone="green">
          {rules.choose.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border bg-card px-3 py-2.5">
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) =>
                  change({
                    ...rules,
                    choose: rules.choose.map((x) => (x.id === c.id ? { ...x, enabled: e.target.checked } : x)),
                  })
                }
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#4d7d14]"
              />
              <span className="text-[13px] font-medium">{c.label}</span>
            </label>
          ))}
        </Column>

        <Column number="3" title="Break ties" where="runs in code, after the model" nature="only reorders what is valid" tone="navy">
          {rules.tieBreak.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border bg-card px-3 py-2.5">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={(e) =>
                  change({
                    ...rules,
                    tieBreak: rules.tieBreak.map((x) => (x.id === t.id ? { ...x, enabled: e.target.checked } : x)),
                  })
                }
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#0e2d7c]"
              />
              <span className="text-[13px] font-medium">{t.label}</span>
            </label>
          ))}
        </Column>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-[340px] flex-[1_1_420px]">
          <h2 className="mb-2.5 text-sm font-semibold">Prompt preview</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-slate-900 px-4 py-3.5 font-mono text-xs leading-relaxed text-slate-200">
            {prompt || '(column 2 is empty, so no preference reaches the model)'}
          </pre>
        </section>

        <section className="min-w-[520px] flex-[999_1_720px]">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-3">
            <h2 className="text-sm font-semibold">Rehearsal</h2>
            <span className="text-[12.5px] text-muted-foreground">
              The filter lane only, run against the real catalogue. No model calls.
            </span>
          </div>

          <div role="group" aria-label="Test seed" className="mb-3 flex flex-wrap gap-1.5">
            {rehearsals.map((r, i) => (
              <button
                key={r.seed.sku}
                type="button"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  i === active ? 'border-slate-400 bg-background' : 'border-input bg-secondary/60 text-muted-foreground',
                )}
              >
                {r.seed.name.slice(0, 34)}
                {r.left === 0 && <span className="ml-1.5 text-orange-700">0</span>}
              </button>
            ))}
          </div>

          {lab && (
            <div className="flex flex-wrap items-stretch gap-3.5">
              <div className="min-w-[270px] flex-[1_1_290px] overflow-hidden rounded-[10px] border">
                <div className="border-b bg-secondary/60 px-3.5 pb-2 pt-2.5">
                  <div className="text-xs font-semibold text-slate-700">
                    {lab.seed.name.slice(0, 44)} · {lab.seed.price.toLocaleString('da-DK')} kr
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    tier {lab.seed.tier ?? '—'} · {lab.seed.stockBand === '0' ? 'out of stock' : lab.seed.stockBand}
                  </div>
                </div>
                {lab.funnel.map((f, i) => (
                  <div
                    key={`${f.rule}-${i}`}
                    className={cn('flex items-center gap-2.5 border-t px-3.5 py-2', f.fatal && 'bg-orange-50')}
                  >
                    <span className={cn('flex-grow text-[12.5px]', f.fatal ? 'text-orange-900' : 'text-slate-700')}>
                      {f.rule}
                    </span>
                    <span className="tnum min-w-[34px] text-right text-[11.5px] text-orange-700">
                      {f.dropped ? `−${f.dropped}` : ''}
                    </span>
                    <span className={cn('tnum min-w-[34px] text-right text-[13px] font-semibold', f.fatal && 'text-orange-800')}>
                      {f.left}
                    </span>
                  </div>
                ))}
                <div
                  className={cn(
                    'border-t px-3.5 py-2.5',
                    lab.left === 0 ? 'bg-orange-50' : 'bg-lime-50',
                  )}
                >
                  <div className={cn('text-[12.5px] font-semibold', lab.left === 0 ? 'text-orange-900' : 'text-lime-800')}>
                    {lab.left === 0 ? 'Nothing reaches the model' : `${lab.left} candidates reach the model`}
                  </div>
                </div>
              </div>

              <div className="min-w-[330px] flex-[999_1_390px] overflow-hidden rounded-[10px] border">
                <div className="border-b bg-secondary/60 px-3.5 pb-2 pt-2.5 text-xs font-semibold text-slate-700">
                  What reached the last rule
                </div>
                <ul className="max-h-[300px] overflow-y-auto">
                  {lab.lastSurvivors.map((p) => (
                    <li key={p.sku} className="flex flex-wrap items-center gap-2.5 border-t px-3.5 py-1.5">
                      <span
                        className={cn(
                          'min-w-[150px] flex-grow text-[12.5px]',
                          p.dropped ? 'text-muted-foreground line-through' : 'text-slate-700',
                        )}
                      >
                        {p.name}
                      </span>
                      <span className="tnum whitespace-nowrap text-xs text-muted-foreground">
                        {p.price.toLocaleString('da-DK')} kr
                      </span>
                      <span className="min-w-[36px] whitespace-nowrap text-right text-[11.5px] text-orange-700">
                        {p.stockBand}
                      </span>
                    </li>
                  ))}
                  {lab.lastSurvivors.length === 0 && (
                    <li className="px-3.5 py-3 text-[12.5px] text-muted-foreground">nothing got that far</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <p className="mt-3 rounded-[9px] border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-orange-900">
            Not wired in yet. The rehearsal reads the real catalogue and tells the truth about it, but the recommend
            workflow still builds its pool with these rules hardcoded, so saving a set does not change a run.
          </p>
        </section>
      </div>
    </main>
  );
}

function Column({
  number,
  title,
  where,
  nature,
  tone,
  children,
}: {
  number: string;
  title: string;
  where: string;
  nature: string;
  tone: 'navy' | 'green';
  children: React.ReactNode;
}) {
  const strong = tone === 'navy' ? '#0e2d7c' : '#4d7d14';
  return (
    <section
      className={cn(
        'flex min-w-[300px] flex-1 flex-col rounded-xl border',
        tone === 'navy' ? 'bg-secondary/40' : 'bg-lime-50/50',
      )}
    >
      <div className="border-b px-4 pb-3 pt-3.5">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{ background: strong }}
          >
            {number}
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="text-xs font-medium" style={{ color: strong }}>
          {where}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{nature}</div>
      </div>
      <div className="flex flex-grow flex-col gap-2 p-3">{children}</div>
    </section>
  );
}
