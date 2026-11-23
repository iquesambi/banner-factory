import { NextResponse } from 'next/server';
import { search, catalogueSize } from '@/app/lib/search.js';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json({ hits: search(q), total: catalogueSize() });
}
