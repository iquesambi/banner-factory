import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

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
