import { NextResponse } from 'next/server';
import {
  abandonTest, measurementLine, openTest, propose, refresh, rows, stopTest, whatOf,
} from '@/app/lib/measure.js';
import { learnFromExperiments } from '@/app/lib/learn.js';
import type { Change } from '@/src/experiment/index.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Asking the researcher is one call to a large model; the default is too short. */
export const maxDuration = 120;

/**
 * The measurement screen's data, and the four things a person can do with
 * it: ask what to try, open the test, stop it, or throw it away.
 *
 * Opening a test renders a banner and costs model calls, so it only ever
 * happens because somebody pressed the button.
 */
export async function GET() {
  refresh();
  const data = rows().map((row) => ({
    jobId: row.job.id,
    png: row.job.png,
    product: row.job.brief?.product.name ?? row.job.seed.name,
    sku: row.job.brief?.product.sku ?? row.job.seed.sku,
    language: row.job.language,
    headline: row.job.brief?.copy.headline ?? '',
    cta: row.job.brief?.copy.cta ?? '',
    layout: row.job.brief?.design.layout ?? 'classic',
    performance: row.performance,
    measurement: measurementLine(row.performance),
    verdicts: row.verdicts,
    experiment: row.experiment
      ? {
          ...row.experiment,
          what: whatOf(row.experiment.change),
          measured: row.measured,
        }
      : null,
  }));
  return NextResponse.json({ rows: data });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown; jobId?: unknown; id?: unknown; change?: unknown; because?: unknown;
    by?: unknown; note?: unknown;
  };
  const action = typeof body.action === 'string' ? body.action : '';
  const by = typeof body.by === 'string' && body.by.trim() ? body.by.trim() : 'someone';

  try {
    if (action === 'propose') {
      if (typeof body.jobId !== 'string') {
        return NextResponse.json({ error: 'expected jobId' }, { status: 400 });
      }
      const proposal = await propose(body.jobId);
      return NextResponse.json({ ok: true, proposal });
    }

    if (action === 'open') {
      if (typeof body.jobId !== 'string' || !body.change) {
        return NextResponse.json({ error: 'expected jobId and change' }, { status: 400 });
      }
      const experiment = openTest(
        body.jobId,
        body.change as Change,
        typeof body.because === 'string' ? body.because : '',
      );
      return NextResponse.json({ ok: true, experiment });
    }

    if (action === 'stop') {
      if (typeof body.id !== 'string') {
        return NextResponse.json({ error: 'expected id' }, { status: 400 });
      }
      const experiment = stopTest(body.id, by, typeof body.note === 'string' ? body.note : '');
      /** A finished test is evidence; it goes to the prompt loop straight away. */
      const learned = learnFromExperiments();
      return NextResponse.json({ ok: true, experiment, learned });
    }

    if (action === 'abandon') {
      if (typeof body.id !== 'string') {
        return NextResponse.json({ error: 'expected id' }, { status: 400 });
      }
      abandonTest(body.id);
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: 'expected action: propose | open | stop | abandon' },
    { status: 400 },
  );
}
