import { NextResponse } from 'next/server';
import { deleteJob, getJob, rateStage, redoFrom } from '@/app/lib/jobs.js';
import { VERDICT_STAGES, type VerdictStage } from '@/app/lib/types';
import { callerFrom } from '@/src/firebase/profiles.js';
import { canJudge, whyNot } from '@/src/auth/roles.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ job });
}

/**
 * One stage's verdict. Stored with the job, which already holds the whole
 * brief, so the judgement sits next to what produced it.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    stage?: unknown; value?: unknown; by?: unknown;
  };

  const stage = body.stage as VerdictStage;
  if (!VERDICT_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `expected { stage: ${VERDICT_STAGES.join(' | ')} }` },
      { status: 400 },
    );
  }
  const value = body.value === 'up' || body.value === 'down' ? body.value : null;

  /**
   * The role is checked HERE, not on the screen.
   *
   * The screen greys out what you may not judge, which is courtesy. This is
   * the part that means something: the caller is whoever their ID token says
   * they are, their role comes from a document only this server can write,
   * and a verdict outside their craft is refused however the request was
   * made. An author taken from the request body would be a claim, and the
   * improvement loop downstream treats these as expert judgement.
   */
  const caller = await callerFrom(request);
  if (!caller.unverified) {
    if (!caller.uid) {
      return NextResponse.json({ error: 'sign in to judge a banner' }, { status: 401 });
    }
    if (!canJudge(caller.role, stage)) {
      return NextResponse.json({ error: whyNot(caller.role, stage) }, { status: 403 });
    }
  }

  /**
   * Who said it: the verified identity when there is one. On a machine with
   * no Firebase credentials nobody can be identified, so the verdict is
   * recorded without an author rather than with an unchecked one.
   */
  const by = caller.unverified ? null : (caller.email ?? caller.uid);

  const job = rateStage(id, stage, value, by);
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ job });
}

/** Throwing a stuck card away. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gone = await deleteJob(id);
  if (!gone) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ deleted: id });
}

/**
 * Doing a stage again, and everything after it.
 *
 * The board sends this when a card is dragged back to an earlier column,
 * which is how a person says they disagree with what that stage produced.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { from?: unknown };
  const from = body.from;
  if (from !== 'choosing' && from !== 'writing' && from !== 'drawing') {
    return NextResponse.json({ error: 'expected { from: choosing | writing | drawing }' }, { status: 400 });
  }

  const job = await redoFrom(id, from);
  if (!job) return NextResponse.json({ error: 'no such job' }, { status: 404 });
  return NextResponse.json({ job });
}
