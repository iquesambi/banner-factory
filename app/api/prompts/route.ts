import { NextResponse } from 'next/server';
import {
  activeRevision, candidateOf, isPromptId, loadPrompts, promote, recordOf, reject, rollBack,
  savePrompts, type PromptId,
} from '@/src/prompts/index.js';
import { PROMPT_META } from '@/src/prompts/registry.js';
import { improvePrompt, statusOf } from '@/src/improve/run.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** The loop calls a pro model several times; the default 15s is not enough. */
export const maxDuration = 300;

/**
 * The improvement screen's data, and the four decisions a person can make
 * about a prompt: run the loop, accept a candidate, refuse it, or undo what
 * is live.
 *
 * Running costs money, so it only ever happens because somebody pressed the
 * button. There is no schedule in this project and no timer that calls it.
 */
export async function GET() {
  const book = loadPrompts();
  const rows = statusOf(book).map((row) => ({
    id: row.meta.id,
    label: row.meta.label,
    role: row.meta.role,
    baseline: row.meta.baseline,
    window: row.record.window,
    since: row.record.since,
    live: row.active,
    candidate: row.candidate,
    evidence: {
      cases: row.evidence.cases.length,
      up: row.evidence.up,
      down: row.evidence.down,
      redos: row.evidence.redos,
      window: row.evidence.window,
      ready: row.evidence.ready,
      why: row.evidence.why,
    },
    history: row.record.revisions
      .map((r) => ({
        version: r.version,
        state: r.state,
        at: r.at,
        by: r.by,
        note: r.note,
        decidedBy: r.decidedBy,
        evaluation: r.evaluation,
      }))
      .reverse(),
  }));
  return NextResponse.json({ approval: book.approval, prompts: rows });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown; id?: unknown; value?: unknown; by?: unknown; force?: unknown; skipEval?: unknown;
  };
  const action = typeof body.action === 'string' ? body.action : '';
  const by = typeof body.by === 'string' && body.by.trim() ? `human:${body.by.trim()}` : 'human';

  if (action === 'approval') {
    const value = body.value === 'auto' ? 'auto' : 'human';
    savePrompts({ ...loadPrompts(), approval: value });
    return NextResponse.json({ ok: true, approval: value });
  }

  if (!isPromptId(body.id)) {
    return NextResponse.json(
      { error: `expected id: one of ${Object.keys(PROMPT_META).join(', ')}` },
      { status: 400 },
    );
  }
  const id: PromptId = body.id;

  if (action === 'run') {
    const result = await improvePrompt(id, {
      force: body.force === true,
      skipEval: body.skipEval === true,
    });
    return NextResponse.json({ ok: true, result });
  }

  const book = loadPrompts();

  if (action === 'promote' || action === 'reject') {
    const candidate = candidateOf(book, id);
    if (!candidate) return NextResponse.json({ error: 'nothing is waiting' }, { status: 400 });
    const next = action === 'promote'
      ? promote(book, id, candidate.version, by)
      : reject(book, id, candidate.version, by);
    savePrompts(next);
    return NextResponse.json({ ok: true, window: recordOf(next, id).window });
  }

  if (action === 'rollback') {
    if (!activeRevision(book, id)) {
      return NextResponse.json({ error: 'this prompt is already on its baseline' }, { status: 400 });
    }
    savePrompts(rollBack(book, id, by));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: 'expected action: run | promote | reject | rollback | approval' },
    { status: 400 },
  );
}
