import { NextResponse } from 'next/server';
import { getJob, rateJob } from '@/app/lib/jobs.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ job });
}

/** The thumbs. Stored with the job, which already holds the whole brief. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { rating?: unknown; reason?: unknown };

  const rating = body.rating === 'up' || body.rating === 'down' ? body.rating : null;
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

  const job = rateJob(id, rating, reason);
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ job });
}
