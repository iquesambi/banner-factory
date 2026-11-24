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

  const parsed = body as {
    items?: Array<{
      sku?: unknown; language?: unknown;
      /** A product named up front, which skips the matcher. */
      pick?: unknown; how?: unknown; fromJobId?: unknown;
    }>;
    reuse?: unknown;
  };
  const items = parsed.items;
  /** Reuse is the default; the person has to ask for a fresh banner. */
  const optOut = parsed.reuse === false;
  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: 'expected items: [{ sku, language }]' }, { status: 400 });
  }

  const created = [];
  for (const item of items) {
    const sku = typeof item.sku === 'string' ? item.sku : '';
    const language = LANGUAGES.includes(item.language as Language) ? (item.language as Language) : 'da';
    if (!sku) continue;
    /**
     * Two buttons name the product themselves: the banner for the seed, and
     * the same banner in another language. Anything else leaves the choice
     * to the matcher, which is the normal path.
     */
    const pick = typeof item.pick === 'string' && item.pick ? item.pick : null;
    const how = item.how === 'translation' ? 'translation' : 'seed';
    try {
      created.push(
        enqueue(sku, language, {
          reuseOptOut: optOut,
          ...(pick
            ? {
                forPick: {
                  sku: pick,
                  how,
                  fromJobId: typeof item.fromJobId === 'string' ? item.fromJobId : null,
                },
              }
            : {}),
        }),
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ jobs: created }, { status: 201 });
}
