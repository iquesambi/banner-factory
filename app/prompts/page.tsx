'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, cn } from '@/components/ui/primitives';
import { useAuth } from '@/app/lib/auth';

/**
 * The improvement screen.
 *
 * The loop can run without anyone here — feedback accumulates, a pro model
 * rewrites the prompt, the reviewer compares the two on real products and a
 * change that wins goes live. This page is where a person can watch that
 * happen, disagree with it, and take the decision back.
 *
 * Which is also why "Approval" is the first control on it. A team that
 * trusts the reviewer sets it to auto and reads this page afterwards; a team
 * that does not sets it to human and nothing changes without a click. Both
 * are legitimate and neither is hidden in a config file.
 */

interface EvalSummary {
  wins: number; losses: number; ties: number; broke: number; cases: number;
  model: string; at: string; notes: string[]; usd: number | null;
}

interface Revision {
  version: number;
  text: string;
  at: string;
  by: string;
  note: string;
  from: { verdicts: number; down: number; jobIds: string[] } | null;
  evaluation: EvalSummary | null;
  state: string;
  decidedBy: string | null;
}

interface Row {
  id: string;
  label: string;
  role: string;
  baseline: string;
  window: number;
  since: string;
  live: Revision | null;
  candidate: Revision | null;
  evidence: {
    cases: number; up: number; down: number; redos: number;
    window: number; ready: boolean; why: string;
  };
  history: Array<{
    version: number; state: string; at: string; by: string; note: string;
    decidedBy: string | null; evaluation: EvalSummary | null;
  }>;
}

interface RunResult {
  outcome: string;
  headline: string;
  note: string;
  changes: string[];
  cases: Array<{ product: string; from: string; better: string; because: string; broken: string[] }>;
  usd: number | null;
  calls: number;
}

export default function PromptsPage() {
  const { user } = useAuth();
  const [approval, setApproval] = useState<'auto' | 'human'>('human');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ran, setRan] = useState<Record<string, RunResult>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/prompts');
    const data = (await res.json()) as { approval: 'auto' | 'human'; prompts: Row[] };
    setApproval(data.approval);
    setRows(data.prompts);
  }

  useEffect(() => { void load(); }, []);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(`${id}:${action}`);
    setError(null);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id, by: user?.email ?? null, ...extra }),
      });
      const data = (await res.json()) as { error?: string; result?: RunResult };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.result) setRan((r) => ({ ...r, [id]: data.result! }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1120px] px-8 pb-16 pt-5">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Improving the prompts</h1>
      <p className="mb-6 max-w-[680px] text-[13.5px] leading-relaxed text-muted-foreground">
        Every thumb on a banner is attached to the agent that did that part of the work. Once enough
        of them have come in, a larger model reads them together with the instructions that produced
        them and rewrites those instructions. The new version is then compared against the live one
        on real products, by a reviewer that never sees either prompt — and a version that does not
        win is rolled back, with the next attempt made to wait for more evidence.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[11px] border bg-secondary/40 px-4 py-3">
        <div className="min-w-[200px] flex-grow">
          <div className="text-[12.5px] font-semibold">Who promotes a change</div>
          <div className="text-[12px] text-muted-foreground">
            {approval === 'auto'
              ? 'A candidate the reviewer prefers goes live on its own. One the reviewer refuses never does.'
              : 'Nothing goes live until someone here says so, however the reviewer judged it.'}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(['human', 'auto'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setApproval(mode);
                void fetch('/api/prompts', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ action: 'approval', value: mode }),
                });
              }}
              className={
                approval === mode
                  ? 'rounded-full bg-elgi-navy px-3 py-1 text-[12px] font-medium text-white'
                  : 'rounded-full border bg-card px-3 py-1 text-[12px] text-slate-700 hover:border-slate-400'
              }
            >
              {mode === 'human' ? 'A person' : 'The reviewer'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="flex flex-col gap-4">
        {rows?.map((row) => (
          <PromptCard
            key={row.id}
            row={row}
            busy={busy}
            ran={ran[row.id] ?? null}
            onAct={act}
          />
        ))}
      </div>
    </main>
  );
}

function PromptCard({
  row,
  busy,
  ran,
  onAct,
}: {
  row: Row;
  busy: string | null;
  ran: RunResult | null;
  onAct: (id: string, action: string, extra?: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState<'none' | 'live' | 'candidate'>('none');
  const live = row.live;
  const candidate = row.candidate;
  const running = busy === `${row.id}:run`;

  return (
    <section className="overflow-hidden rounded-[12px] border bg-card">
      <header className="flex flex-wrap items-start gap-3 border-b px-5 py-4">
        <div className="min-w-[260px] flex-grow">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">{row.label}</h2>
            <Badge tone={live ? 'navy' : undefined}>{live ? `v${live.version}` : 'baseline'}</Badge>
            {candidate && <Badge tone="amber">candidate v{candidate.version} waiting</Badge>}
          </div>
          <p className="mt-1 max-w-[560px] text-[12.5px] leading-relaxed text-muted-foreground">
            {row.role}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => onAct(row.id, 'run', { force: !row.evidence.ready })}
            title={
              row.evidence.ready
                ? 'Read the feedback and propose a new version'
                : 'There is not enough feedback yet; this runs it anyway'
            }
          >
            {running ? 'Reading the feedback…' : row.evidence.ready ? 'Improve it' : 'Improve it anyway'}
          </Button>
          {live && (
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => onAct(row.id, 'rollback')}
              title="Go back to the version that was live before this one"
            >
              Undo
            </Button>
          )}
        </div>
      </header>

      {/* The evidence, which is the whole reason any of this runs. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-secondary/30 px-5 py-3 text-[12.5px]">
        <Figure label="Verdicts since the change" value={`${row.evidence.cases} of ${row.evidence.window}`} />
        <Figure label="Approved" value={String(row.evidence.up)} />
        <Figure label="Complaints" value={String(row.evidence.down)} tone={row.evidence.down ? 'amber' : 'plain'} />
        <Figure label="Paid reruns" value={String(row.evidence.redos)} />
        <div className="min-w-[180px] flex-grow text-right text-muted-foreground">{row.evidence.why}</div>
      </div>

      {candidate && (
        <div className="border-b bg-amber-50/40 px-5 py-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-amber-900">
              A new version is waiting
            </span>
            <span className="text-[12px] text-amber-800">
              written by {candidate.by.replace('improver:', '')}
              {candidate.from && ` from ${candidate.from.verdicts} verdicts, ${candidate.from.down} of them complaints`}
            </span>
          </div>
          <p className="mb-2.5 max-w-[760px] text-[12.5px] leading-relaxed text-slate-700">
            {candidate.note}
          </p>

          {candidate.evaluation ? (
            <EvalLine summary={candidate.evaluation} />
          ) : (
            <p className="mb-2.5 text-[12.5px] text-amber-800">
              Not compared against the live version. Promoting it is a judgement, not a measurement.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button disabled={busy !== null} onClick={() => onAct(row.id, 'promote')}>
              Promote it
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => onAct(row.id, 'reject')}>
              Refuse it
            </Button>
            <button
              type="button"
              onClick={() => setOpen(open === 'candidate' ? 'none' : 'candidate')}
              className="text-[12.5px] text-slate-700 underline underline-offset-2"
            >
              {open === 'candidate' ? 'Hide it' : 'Read it'}
            </button>
            <span className="text-[12px] text-muted-foreground">
              Refusing widens the window to {Math.ceil(row.window * 1.5)} verdicts.
            </span>
          </div>

          {open === 'candidate' && <Instructions text={candidate.text} />}
        </div>
      )}

      {ran && (
        <div className="border-b px-5 py-4">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone={ran.outcome === 'promoted' ? 'green' : ran.outcome === 'rejected' ? 'amber' : undefined}>
              {ran.outcome.replace('-', ' ')}
            </Badge>
            <span className="text-[13px]">{ran.headline}</span>
          </div>
          {ran.changes.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc text-[12.5px] leading-relaxed text-slate-700">
              {ran.changes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          {ran.cases.length > 0 && (
            <div className="mt-2.5 overflow-hidden rounded-[9px] border">
              {ran.cases.map((c) => (
                <div key={c.product} className="flex flex-wrap items-baseline gap-2 border-t px-3 py-2 text-[12.5px] first:border-t-0">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-medium',
                      c.better === 'candidate' ? 'bg-lime-100 text-lime-800'
                        : c.better === 'live' ? 'bg-orange-100 text-orange-900'
                        : 'bg-secondary text-slate-700',
                    )}
                  >
                    {c.better === 'candidate' ? 'new one' : c.better === 'live' ? 'old one' : 'equal'}
                  </span>
                  <span className="font-medium">{c.product}</span>
                  <span className="text-[11.5px] text-muted-foreground">({c.from})</span>
                  <span className="min-w-[200px] flex-grow text-muted-foreground">{c.because}</span>
                  {c.broken.map((b) => (
                    <span key={b} className="w-full text-[11.5px] text-orange-800">broke: {b}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
          {ran.usd !== null && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              This run cost {(ran.usd * 100).toFixed(2)} cents over {ran.calls} calls.
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-3.5">
        <button
          type="button"
          onClick={() => setOpen(open === 'live' ? 'none' : 'live')}
          className="text-[12.5px] text-slate-700 underline underline-offset-2"
        >
          {open === 'live' ? 'Hide the instructions in force' : 'Read the instructions in force'}
        </button>
        {open === 'live' && <Instructions text={live?.text ?? row.baseline} />}

        {row.history.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {row.history.map((h) => (
              <li key={h.version} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                <span className="tnum w-[34px] text-muted-foreground">v{h.version}</span>
                <Badge
                  tone={h.state === 'active' ? 'green' : h.state === 'rejected' ? 'amber' : undefined}
                >
                  {h.state}
                </Badge>
                <span className="text-muted-foreground">{day(h.at)}</span>
                <span className="min-w-[200px] flex-grow truncate" title={h.note}>{h.note}</span>
                {h.evaluation && (
                  <span className="text-[11.5px] text-muted-foreground">
                    {h.evaluation.wins}–{h.evaluation.losses}–{h.evaluation.ties}
                    {h.evaluation.broke ? ` · ${h.evaluation.broke} broke a rule` : ''}
                  </span>
                )}
                {h.decidedBy && <span className="text-[11.5px] text-muted-foreground">{h.decidedBy}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function EvalLine({ summary }: { summary: EvalSummary }) {
  const good = summary.broke === 0 && summary.wins > summary.losses;
  return (
    <div
      className={cn(
        'rounded-[9px] border px-3 py-2 text-[12.5px]',
        good ? 'border-lime-200 bg-lime-50/70 text-lime-900' : 'border-orange-200 bg-orange-50/60 text-orange-900',
      )}
    >
      <span className="font-semibold">
        {summary.wins} better, {summary.losses} worse, {summary.ties} equal
        {summary.broke > 0 && `, ${summary.broke} broke a rule`}
      </span>{' '}
      over {summary.cases} products, judged by {summary.model}.
      {summary.notes.length > 0 && (
        <ul className="mt-1 list-inside list-disc leading-relaxed">
          {summary.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

function Instructions({ text }: { text: string }) {
  return (
    <pre className="mt-2.5 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[9px] border bg-secondary/40 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-slate-700">
      {text}
    </pre>
  );
}

function Figure({ label, value, tone = 'plain' }: { label: string; value: string; tone?: 'plain' | 'amber' }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('tnum text-[15px] font-semibold', tone === 'amber' && 'text-orange-800')}>
        {value}
      </div>
    </div>
  );
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
