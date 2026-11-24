import { NextResponse } from 'next/server';
import { loadTraffic, record, saveTraffic } from '@/src/experiment/index.js';
import { cors, preflight } from '@/app/lib/cors.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What happened to a banner.
 *
 * This is the endpoint a real site would call: one impression when the
 * banner is rendered, one click when somebody follows it. Everything the
 * measurement tool says rests on these two numbers, and nothing else in the
 * system writes them.
 *
 * `simulated: true` is kept as a separate pair of counters all the way
 * through, never added to the real ones. There is no live site behind this
 * yet, and the one thing this feature must never do is let a demo look like
 * a result.
 */
/** A tag on another site sends a preflight before it may POST here. */
export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    jobId?: unknown; event?: unknown; simulated?: unknown; times?: unknown;
  };

  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  const event = body.event === 'click' ? 'click' : body.event === 'impression' ? 'impression' : null;
  if (!jobId || !event) {
    return cors(
      NextResponse.json({ error: 'expected { jobId, event: impression | click }' }, { status: 400 }),
    );
  }

  const times = typeof body.times === 'number' && body.times > 0 ? Math.min(Math.floor(body.times), 100_000) : 1;
  const simulated = body.simulated === true;

  const book = record(loadTraffic(), jobId, event, simulated, times);
  saveTraffic(book);
  return cors(NextResponse.json({ ok: true, tally: book[jobId] }));
}
