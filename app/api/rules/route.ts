import { NextResponse } from 'next/server';
import { loadRules, saveRules, choosePrompt, rehearse, type RuleSet } from '@/app/lib/rules.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEST_SEEDS = ['802582', '998757', '1083310', '1118606'];

export async function GET() {
  const rules = loadRules();
  return NextResponse.json({
    rules,
    prompt: choosePrompt(rules),
    rehearsals: TEST_SEEDS.map((sku) => rehearse(sku, rules)).filter(Boolean),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { rules?: RuleSet } | null;
  if (!body?.rules) return NextResponse.json({ error: 'expected { rules }' }, { status: 400 });

  const rules = saveRules(body.rules);
  return NextResponse.json({
    rules,
    prompt: choosePrompt(rules),
    rehearsals: TEST_SEEDS.map((sku) => rehearse(sku, rules)).filter(Boolean),
  });
}

/** Rehearsing without saving: the whole point of a rehearsal. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { rules?: RuleSet } | null;
  if (!body?.rules) return NextResponse.json({ error: 'expected { rules }' }, { status: 400 });
  return NextResponse.json({
    prompt: choosePrompt(body.rules),
    rehearsals: TEST_SEEDS.map((sku) => rehearse(sku, body.rules as RuleSet)).filter(Boolean),
  });
}
