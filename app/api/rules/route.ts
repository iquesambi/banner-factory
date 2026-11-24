import { NextResponse } from 'next/server';
import { loadRules, saveRules, type ReuseRules } from '@/app/lib/rules.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ rules: loadRules() });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { rules?: ReuseRules } | null;
  if (!body?.rules) return NextResponse.json({ error: 'expected { rules }' }, { status: 400 });
  return NextResponse.json({ rules: saveRules(body.rules) });
}
