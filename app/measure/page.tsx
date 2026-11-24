'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, cn } from '@/components/ui/primitives';
import { useAuth } from '@/app/lib/auth';

/**
 * How the banners are doing, and what to try when one is not.
 *
 * The order on this page is the order of the method: a banner's numbers
 * first, a judgement about them second, and a test only when that judgement
 * says something is wrong. Nothing here offers to test a banner that is
 * doing fine — that spends traffic to confirm what is already known.
 */

interface Performance {
  counts: { impressions: number; clicks: number };
  source: 'real' | 'simulated';
  rate: number;
  baseline: number;
  standing: 'no-data' | 'too-early' | 'ahead' | 'behind' | 'even';
  p: number;
  minimum: number;
}

interface Comparison {
  control: { impressions: number; clicks: number; rate: number; interval: { low: number; high: number } };
  variant: { impressions: number; clicks: number; rate: number; interval: { low: number; high: number } };
  absoluteLift: number;
  relativeLift: number;
  z: number;
  p: number;
  usable: boolean;
}

interface Experiment {
  id: string;
  state: string;
  what: string;
  because: string;
  change: { dimension: string; hypothesis: string; layout?: string; cta?: string; copyDirection?: string };
  requiredPerArm: number;
  variantJobId: string | null;
  decision: {
    winner: string; p: number; relativeLift: number; impressions: number;
    reading: string; source: string; by: string; at: string;
  } | null;
  measured: { comparison: Comparison; reading: string; source: string; needs: number } | null;
}

interface Row {
  jobId: string;
  png: string | null;
  product: string;
  sku: string;
  language: string;
  headline: string;
  cta: string;
  layout: string;
  performance: Performance;
  measurement: string;
  verdicts: string[];
  experiment: Experiment | null;
}

interface Proposal {
  answer: { dimension: string; hypothesis: string; note: string };
  change: Record<string, unknown> & { dimension: string; hypothesis: string };
  usd: number | null;
  fixes: string[];
}

export default function MeasurePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/experiments');
    const data = (await res.json()) as { rows: Row[] };
    setRows(data.rows);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, []);

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, by: user?.email ?? null }),
      });
      const data = (await res.json()) as { error?: string; proposal?: Proposal };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.proposal && typeof body.jobId === 'string') {
        setProposals((p) => ({ ...p, [body.jobId as string]: data.proposal! }));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const anySimulated = rows?.some((r) => r.performance.source === 'simulated');

  return (
    <main className="mx-auto max-w-[1180px] px-8 pb-16 pt-5">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">How the banners are doing</h1>
      <p className="mb-5 max-w-[700px] text-[13.5px] leading-relaxed text-muted-foreground">
        Each banner is measured against the others: its click rate, and whether the difference is
        big enough to be worth believing. A banner that is doing well is left alone. One that is
        measurably behind gets a researcher&rsquo;s attention, and the variant it proposes is
        tested against the original until there is enough traffic to say which won.
      </p>

      {anySimulated && (
        <div className="mb-5 rounded-[11px] border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
          <strong>Some of these numbers are simulated.</strong> There is no live site behind this
          yet, so traffic can be generated to exercise the loop. Simulated counts are kept in their
          own column, never added to real ones, and a test decided on them is recorded but never
          used to rewrite an agent&rsquo;s instructions.
        </div>
      )}

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No banner has been delivered yet, so there is nothing to measure.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {rows?.map((row) => (
          <BannerRow
            key={row.jobId}
            row={row}
            busy={busy}
            proposal={proposals[row.jobId] ?? null}
            onAct={act}
          />
        ))}
      </div>
    </main>
  );
}

function BannerRow({
  row,
  busy,
  proposal,
  onAct,
}: {
  row: Row;
  busy: string | null;
  proposal: Proposal | null;
  onAct: (key: string, body: Record<string, unknown>) => void;
  }) {
  const p = row.performance;
  const experiment = row.experiment;
  const live = experiment && experiment.state !== 'decided' && experiment.state !== 'abandoned';

  return (
    <section className="overflow-hidden rounded-[12px] border bg-card">
      <div className="flex flex-wrap gap-4 p-4">
        {row.png && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/banners/${encodeURIComponent(row.png)}`}
            alt=""
            width={2048}
            height={768}
            className="h-[84px] w-[224px] shrink-0 rounded-[8px] border object-cover"
          />
        )}

        <div className="min-w-[260px] flex-grow">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14.5px] font-semibold">{row.product}</h2>
            <Standing standing={p.standing} />
            {p.source === 'simulated' && <Badge tone="amber">simulated</Badge>}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            &ldquo;{row.headline}&rdquo; · {row.cta} · {row.layout}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12.5px]">
            <Number label="Impressions" value={p.counts.impressions.toLocaleString('en-GB')} />
            <Number label="Clicks" value={p.counts.clicks.toLocaleString('en-GB')} />
            <Number label="Click rate" value={`${(p.rate * 100).toFixed(2)}%`} strong />
            <Number label="The other banners" value={`${(p.baseline * 100).toFixed(2)}%`} />
            {p.standing !== 'no-data' && p.standing !== 'too-early' && (
              <Number label="p" value={p.p.toFixed(3)} />
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-center gap-2">
          {!live && (
            <Button
              variant={p.standing === 'behind' ? 'default' : 'outline'}
              disabled={busy !== null || p.standing === 'no-data'}
              onClick={() => onAct(`${row.jobId}:propose`, { action: 'propose', jobId: row.jobId })}
              title={
                p.standing === 'behind'
                  ? 'Ask the researcher what to try instead'
                  : 'This banner is not behind; a test here spends traffic on a question already answered'
              }
            >
              {busy === `${row.jobId}:propose` ? 'Thinking…' : 'Open an A/B test'}
            </Button>
          )}
          {p.standing === 'ahead' && (
            <span className="text-[11.5px] text-lime-700">ahead of the rest — leave it alone</span>
          )}
        </div>
      </div>

      {/* The researcher's proposal, before it becomes a test. */}
      {proposal && !live && (
        <div className="border-t bg-blue-50/50 px-4 py-3.5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone="navy">{proposal.change.dimension}</Badge>
            <span className="text-[13px] font-semibold">What the researcher wants to try</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-slate-700">
            {describe(proposal.change)}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700">
            <strong>Hypothesis:</strong> {proposal.change.hypothesis}
          </p>
          {proposal.answer.note && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {proposal.answer.note}
            </p>
          )}
          {proposal.fixes.map((f) => (
            <p key={f} className="mt-1.5 text-[12px] text-orange-800">{f}</p>
          ))}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              disabled={busy !== null}
              onClick={() =>
                onAct(`${row.jobId}:open`, {
                  action: 'open',
                  jobId: row.jobId,
                  change: proposal.change,
                  because: row.measurement,
                })
              }
            >
              Make the variant and start
            </Button>
            <span className="text-[12px] text-muted-foreground">
              This renders a second banner and begins splitting traffic evenly.
            </span>
          </div>
        </div>
      )}

      {experiment && <Test row={row} experiment={experiment} busy={busy} onAct={onAct} />}
    </section>
  );
}

function Test({
  row,
  experiment,
  busy,
  onAct,
}: {
  row: Row;
  experiment: Experiment;
  busy: string | null;
  onAct: (key: string, body: Record<string, unknown>) => void;
}) {
  const m = experiment.measured;
  const c = m?.comparison;
  const decided = experiment.state === 'decided';

  return (
    <div className={cn('border-t px-4 py-3.5', decided ? 'bg-secondary/40' : 'bg-lime-50/40')}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={decided ? undefined : 'green'}>{experiment.state}</Badge>
        <span className="text-[13px] font-semibold">Testing {experiment.what}</span>
        <span className="text-[12px] text-muted-foreground">{experiment.change.dimension}</span>
      </div>
      <p className="mb-2 max-w-[760px] text-[12.5px] leading-relaxed text-slate-700">
        {experiment.change.hypothesis}
      </p>

      {experiment.state === 'building' && (
        <p className="text-[12.5px] text-muted-foreground">
          The variant is being made. It will start taking traffic as soon as it is drawn.
        </p>
      )}

      {c && c.usable && (
        <div className="mb-2.5 flex flex-wrap gap-x-7 gap-y-2 rounded-[9px] border bg-card px-3.5 py-2.5 text-[12.5px]">
          <Arm label="The original" arm={c.control} />
          <Arm label="The variant" arm={c.variant} />
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Difference</div>
            <div className="tnum text-[15px] font-semibold">
              {c.relativeLift >= 0 ? '+' : ''}{(c.relativeLift * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">p-value</div>
            <div className="tnum text-[15px] font-semibold">{c.p.toFixed(3)}</div>
          </div>
          <div className="min-w-[180px] flex-grow text-right">
            <Reading reading={m!.reading} needs={m!.needs} required={experiment.requiredPerArm} />
          </div>
        </div>
      )}

      {experiment.decision && (
        <p className="mb-2 text-[12.5px] leading-relaxed">
          <strong>
            {experiment.decision.winner === 'variant' ? 'The variant won'
              : experiment.decision.winner === 'control' ? 'The original won'
              : 'No difference was found'}
          </strong>{' '}
          — p = {experiment.decision.p.toFixed(3)} over {experiment.decision.impressions.toLocaleString('en-GB')}{' '}
          impressions, called {experiment.decision.reading}
          {experiment.decision.source === 'simulated' && ' on simulated traffic'}. This has been
          written into what the agents learn from.
        </p>
      )}

      {!decided && experiment.state !== 'abandoned' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => onAct(`${experiment.id}:stop`, { action: 'stop', id: experiment.id })}
          >
            Stop and decide
          </Button>
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => onAct(`${experiment.id}:abandon`, { action: 'abandon', id: experiment.id })}
          >
            Throw it away
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Stopping before {experiment.requiredPerArm.toLocaleString('en-GB')} impressions an arm
            records the result as a peek, not as a finding.
          </span>
        </div>
      )}

      {row.verdicts.length > 0 && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Judged on the board: {row.verdicts.join(' · ')}
        </p>
      )}
    </div>
  );
}

function Arm({ label, arm }: { label: string; arm: Comparison['control'] }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tnum text-[15px] font-semibold">{(arm.rate * 100).toFixed(2)}%</div>
      <div className="tnum text-[11px] text-muted-foreground">
        {arm.clicks.toLocaleString('en-GB')} / {arm.impressions.toLocaleString('en-GB')} ·{' '}
        {(arm.interval.low * 100).toFixed(1)}–{(arm.interval.high * 100).toFixed(1)}%
      </div>
    </div>
  );
}

/**
 * What the numbers are allowed to be called.
 *
 * A p-value read before the planned sample is a peek, and saying so is the
 * difference between a test and a slot machine.
 */
function Reading({ reading, needs, required }: { reading: string; needs: number; required: number }) {
  if (reading === 'conclusive') {
    return <span className="text-[12px] font-semibold text-lime-700">conclusive</span>;
  }
  if (reading === 'inconclusive') {
    return (
      <span className="text-[12px] text-muted-foreground">
        enough data, no difference found
      </span>
    );
  }
  if (reading === 'peek') {
    return (
      <span className="text-[12px] text-amber-800">
        a peek — {needs.toLocaleString('en-GB')} more impressions an arm, of{' '}
        {required.toLocaleString('en-GB')}
      </span>
    );
  }
  return <span className="text-[12px] text-muted-foreground">no data yet</span>;
}

function Standing({ standing }: { standing: Performance['standing'] }) {
  if (standing === 'ahead') return <Badge tone="green">ahead</Badge>;
  if (standing === 'behind') return <Badge tone="amber">behind</Badge>;
  if (standing === 'even') return <Badge>no difference</Badge>;
  if (standing === 'too-early') return <Badge>too early</Badge>;
  return <Badge>not measured</Badge>;
}

function Number({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('tnum', strong ? 'text-[15px] font-semibold' : 'text-[13px]')}>{value}</div>
    </div>
  );
}

function describe(change: Record<string, unknown> & { dimension: string }): string {
  if (change.dimension === 'layout') return `Lay it out as "${String(change.layout)}" instead.`;
  if (change.dimension === 'cta') return `Change the button to "${String(change.cta)}".`;
  return `Rewrite the copy: ${String(change.copyDirection ?? '')}`;
}
