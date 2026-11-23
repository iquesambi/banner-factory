import { NextResponse } from 'next/server';
import { enqueue, listJobs } from '@/app/lib/jobs.js';
import type { Language } from '@/src/banner/facts.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANGUAGES: Language[] = ['da', 'sv', 'en'];

/**
 * The board polls this. A production deployment would push instead — the
 * workflow already emits every stage, and the design has that going into
 * Firestore for the client to listen on. Polling keeps the same shape
 * without standing up Firebase to see it work.
 */
export async function GET() {
  return NextResponse.json({ jobs: listJobs() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const items = (body as { items?: Array<{ sku?: unknown; language?: unknown }> }).items;
  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: 'expected items: [{ sku, language }]' }, { status: 400 });
  }

  const created = [];
  for (const item of items) {
    const sku = typeof item.sku === 'string' ? item.sku : '';
    const language = LANGUAGES.includes(item.language as Language) ? (item.language as Language) : 'da';
    if (!sku) continue;
    try {
      created.push(enqueue(sku, language));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ jobs: created }, { status: 201 });
}
