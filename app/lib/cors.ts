import type { NextResponse } from 'next/server';
import { NextResponse as Res } from 'next/server';

/**
 * The three endpoints a banner tag uses, opened to other origins.
 *
 * A pixel installed on somebody else's site is cross-origin by definition,
 * so without this the browser refuses the request before it is ever sent and
 * the tag silently shows nothing.
 *
 * Wide open, and that is a deliberate reading of what these endpoints are: a
 * banner to show, an impression and a click. They carry no personal data,
 * they read nothing about the caller, and the only thing a stranger can do
 * with them is add counts to a banner they would have to know the id of.
 * That is the same exposure any ad tag has. Nothing else in this app is
 * opened this way — the job, policy, prompt and experiment endpoints stay
 * same-origin, because those change things.
 */
const HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export function cors(response: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(HEADERS)) response.headers.set(k, v);
  return response;
}

export function preflight(): NextResponse {
  return cors(new Res(null, { status: 204 }));
}
