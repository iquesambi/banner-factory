import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { NextResponse } from 'next/server';
import { removeBanner } from '@/app/lib/jobs.js';

export const runtime = 'nodejs';

/**
 * Serves a rendered banner out of `.cache/banners`.
 *
 * The name is reduced to its basename before it touches the filesystem, so a
 * request cannot walk out of that directory, and only `.png` is served.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = basename(file);
  if (!name.endsWith('.png')) return new Response('not found', { status: 404 });

  const path = `.cache/banners/${name}`;
  if (!existsSync(path)) return new Response('not found', { status: 404 });

  return new Response(new Uint8Array(readFileSync(path)), {
    headers: {
      'content-type': 'image/png',
      // The file never changes once written: its name carries the job id.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * Throwing a banner away.
 *
 * The image, the files it was rendered from, the copy in Cloud Storage and
 * every run that answered with it — because a banner reused by three
 * requests is one picture, and deleting a third of it would leave the other
 * two pointing at nothing.
 *
 * A real delete. The screen asks first; this does not ask twice.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = basename(file);
  if (!name.endsWith('.png')) return NextResponse.json({ error: 'not a banner' }, { status: 400 });

  const gone = await removeBanner(name);
  if (!gone) return NextResponse.json({ error: 'no banner by that name' }, { status: 404 });
  return NextResponse.json({ deleted: gone });
}
