/**
 * Checking a Firebase ID token without a service account.
 *
 * The Admin SDK needs a private key, and a private key cannot travel with a
 * repository. But verifying who somebody is does not need one: a Firebase ID
 * token is an ordinary RS256 JWT signed by Google, and Google publishes the
 * certificates to check it against. The private half is only needed to ACT on
 * the project — to write documents, to bypass the rules — not to read a
 * signature.
 *
 * That distinction is what lets this project be cloned and still have real
 * accounts and real roles: whoever runs it signs in to the same Firebase
 * project, their token is verified here against Google's public keys, and
 * their role comes from `config/people.json`, which is in the repository.
 * Nothing secret is required for any of it.
 *
 * What is lost without the service account is only the storing: no profile
 * document is written, so a role given on the screen cannot be saved. The
 * seeded ones work exactly as they do with it.
 */
import { createPublicKey, createVerify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface TokenClaims {
  uid: string;
  email: string | null;
  name: string | null;
}

/** Google rotates these; the response says for how long it may be held. */
let certs: { keys: Record<string, string>; until: number } | null = null;

async function publicKeys(): Promise<Record<string, string>> {
  if (certs && certs.until > Date.now()) return certs.keys;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error(`could not read Google's signing certificates: HTTP ${res.status}`);
  const keys = (await res.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  certs = { keys, until: Date.now() + maxAge * 1000 };
  return keys;
}

/** The project this app belongs to: the environment first, then the shipped config. */
export function verifiableProjectId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const path = resolve(process.cwd(), 'config/firebase.json');
    if (!existsSync(path)) return null;
    const shipped = JSON.parse(readFileSync(path, 'utf8')) as { config?: { projectId?: string } };
    return shipped.config?.projectId ?? null;
  } catch {
    return null;
  }
}

const decode = (part: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

/**
 * Returns who the token says they are, or null.
 *
 * Every condition below is a way a token can be true-looking and wrong, and
 * each one is checked rather than assumed: the right signature from the wrong
 * project, a token minted for another Firebase app, one that has expired, one
 * signed with an algorithm the attacker chose.
 */
export async function verifyIdToken(token: string): Promise<TokenClaims | null> {
  const projectId = verifiableProjectId();
  if (!projectId) return null;

  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) return null;

  try {
    const header = decode(headerPart) as { alg?: string; kid?: string };
    /** `alg: none` and HMAC-with-the-public-key are the classic JWT forgeries. */
    if (header.alg !== 'RS256' || !header.kid) return null;

    const keys = await publicKeys();
    const cert = keys[header.kid];
    if (!cert) return null;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerPart}.${payloadPart}`);
    verifier.end();
    const signature = Buffer.from(
      signaturePart.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    );
    if (!verifier.verify(createPublicKey(cert), signature)) return null;

    const claims = decode(payloadPart) as {
      aud?: string; iss?: string; sub?: string; exp?: number; iat?: number;
      email?: string; name?: string;
    };

    const now = Math.floor(Date.now() / 1000);
    if (claims.aud !== projectId) return null;
    if (claims.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!claims.sub || typeof claims.sub !== 'string') return null;
    if (!claims.exp || claims.exp <= now) return null;
    /** A minute of slack, because clocks differ and a fresh token is not from the future. */
    if (claims.iat && claims.iat > now + 60) return null;

    return { uid: claims.sub, email: claims.email ?? null, name: claims.name ?? null };
  } catch {
    return null;
  }
}
