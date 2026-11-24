/**
 * People, and what they are allowed to say.
 *
 * One document per signed-in person in `profiles/{uid}`, written only by this
 * server through the Admin SDK. Clients are denied outright in the rules, and
 * that is the whole point: a role a person can set on themselves is not a
 * role, it is a preference.
 *
 * The Admin SDK bypasses Security Rules, so the check that actually matters
 * lives here and in the route that calls it — the caller's ID token is
 * verified, their own profile is read, and only then are they allowed to
 * change somebody else's.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminAvailable, adminDb } from './admin.js';
import { verifiableProjectId, verifyIdToken } from './verify.js';
import { isRole, type Role } from '../auth/roles.js';

export const PROFILES = 'profiles';

export interface Profile {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role;
  /** Who gave them this role, and when. */
  assignedBy: string | null;
  assignedAt: string | null;
  createdAt: string;
}

/**
 * The people who have a role before anybody has handed one out.
 *
 * Something has to break the circle: roles are assigned by an admin, and
 * before anyone is an admin there is nobody to assign the first one.
 *
 * It lives in `config/people.json`, in the repository, rather than in the
 * environment — because this is a thing you SEND with the project. Whoever
 * receives it can sign in as one of these and have a working factory; a list
 * in a `.env` would arrive empty and leave them locked out of their own
 * copy. Nothing secret belongs in it: an email is not a credential, and
 * these grant nothing that the sign-in itself does not.
 */
export interface SeededPerson {
  email: string;
  role: Role;
  who?: string;
}

const PEOPLE_FILE = 'config/people.json';

/** Re-read when the file changes, so editing it does not need a restart. */
let seededCache: { mtimeMs: number; people: SeededPerson[] } | null = null;

export function seededPeople(): SeededPerson[] {
  /**
   * An environment variable still wins where one is set. A deployment that
   * does not want its people's addresses in a repository says so there, and
   * nothing about the committed file has to change.
   */
  const fromEnv = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email, role: 'admin' as Role }));
  if (fromEnv.length) return fromEnv;

  try {
    const path = resolve(process.cwd(), PEOPLE_FILE);
    if (!existsSync(path)) return [];
    const mtimeMs = statSync(path).mtimeMs;
    if (seededCache && seededCache.mtimeMs === mtimeMs) return seededCache.people;

    const raw = JSON.parse(readFileSync(path, 'utf8')) as { people?: unknown };
    const people = (Array.isArray(raw.people) ? raw.people : [])
      .map((row) => row as Partial<SeededPerson>)
      .filter((row): row is SeededPerson =>
        typeof row.email === 'string' && row.email.includes('@') && isRole(row.role))
      .map((row) => ({ ...row, email: row.email.trim().toLowerCase() }));

    seededCache = { mtimeMs, people };
    return people;
  } catch {
    /** A broken file must not lock everybody out; it just seeds nobody. */
    return [];
  }
}

/** The role this email is seeded with, if any. */
export function seededRole(email: string | null): Role | null {
  if (!email) return null;
  const hit = seededPeople().find((p) => p.email === email.toLowerCase());
  return hit?.role ?? null;
}

export interface Caller {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role | null;
  /**
   * True when the server cannot verify anybody, because Firebase Admin is
   * not configured. Everything is then permitted and nothing is attributed:
   * a single-user machine, which is what this project is until it is
   * deployed. The screens say so rather than implying a security that is
   * not there.
   */
  unverified: boolean;
}

/** Nobody is signed in, and the server can tell. */
export const ANONYMOUS: Caller = {
  uid: '', email: null, name: null, role: null, unverified: false,
};

/**
 * Nobody can be identified at all: no service account AND no project to check
 * a token against. A single-user machine, which is what this is before the
 * Firebase config exists. Everything is permitted and nothing is attributed,
 * and the screens say so rather than implying a security that is not there.
 */
export const UNVERIFIED: Caller = {
  uid: '', email: null, name: null, role: 'admin', unverified: true,
};

/**
 * Who is calling, from the ID token the browser sent.
 *
 * A token is proof; an email in a JSON body is a claim. Everything that
 * depends on a role goes through here, and a request without a verifiable
 * token has no role at all.
 */
export async function callerFrom(request: Request): Promise<Caller> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  /**
   * No service account, but a project to check tokens against.
   *
   * This is the path whoever clones this repository runs on: the signature is
   * checked against Google's public certificates, and the role comes from
   * `config/people.json`. Real identity, real roles, nothing secret needed —
   * only the storing is lost, so a role handed out on the screen cannot be
   * saved until somebody adds a service account.
   */
  if (!adminAvailable()) {
    if (!verifiableProjectId()) return UNVERIFIED;
    if (!token) return ANONYMOUS;
    const claims = await verifyIdToken(token);
    if (!claims) return ANONYMOUS;
    return {
      uid: claims.uid,
      email: claims.email,
      name: claims.name,
      role: seededRole(claims.email),
      unverified: false,
    };
  }

  if (!token) return ANONYMOUS;

  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    /** An expired or forged token is nobody, not an error worth leaking. */
    return ANONYMOUS;
  }

  const email = decoded.email ?? null;
  const name = (decoded.name as string | undefined) ?? null;

  /**
   * The two failures are kept apart, and this cost an hour to learn.
   *
   * A bad token means "I do not know who you are". A Firestore error means
   * "I know who you are and could not look you up" — a completely different
   * thing, and swallowing both as "nobody" made a database problem look
   * exactly like a forged token, with nothing in the log either way.
   *
   * It also no longer takes a round trip to know that a seeded person has a
   * role: that fact lives in a file on this machine. The stored profile can
   * only ADD to it.
   */
  const seeded = seededRole(email);
  try {
    const profile = await profileOf(decoded.uid, email, name);
    return { uid: decoded.uid, email, name, role: profile.role, unverified: false };
  } catch (error) {
    console.error(
      '[profiles] could not read or create the profile for',
      email ?? decoded.uid,
      '—',
      error instanceof Error ? error.message : String(error),
    );
    return { uid: decoded.uid, email, name, role: seeded, unverified: false };
  }
}

/**
 * Reads a profile, creating it the first time somebody signs in.
 *
 * A new person gets no role — not a default one. A default would mean every
 * stranger who signs in can start writing feedback the improvement loop
 * treats as expert judgement, which is exactly the thing roles exist to
 * prevent. The exception is the bootstrap list.
 */
export async function profileOf(
  uid: string,
  email: string | null,
  name: string | null,
): Promise<Profile & { role: Role | null }> {
  const db = adminDb();
  const ref = db.collection(PROFILES).doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    const held = snap.data() as Partial<Profile>;
    const role = isRole(held.role) ? held.role : null;
    /**
     * A seeded person keeps their role even if the document says otherwise.
     * That is the way back in when somebody removes a role by mistake.
     */
    const promoted = seededRole(held.email ?? email) ?? role;
    return {
      uid,
      email: held.email ?? email,
      name: held.name ?? name,
      role: promoted,
      assignedBy: held.assignedBy ?? null,
      assignedAt: held.assignedAt ?? null,
      createdAt: held.createdAt ?? new Date().toISOString(),
    } as Profile & { role: Role | null };
  }

  const role: Role | null = seededRole(email);
  const fresh = {
    uid,
    email,
    name,
    role,
    assignedBy: role ? PEOPLE_FILE : null,
    assignedAt: role ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
  await ref.set(fresh);
  return fresh as Profile & { role: Role | null };
}

export async function listProfiles(): Promise<Array<Profile & { role: Role | null }>> {
  if (!adminAvailable()) return [];
  const snap = await adminDb().collection(PROFILES).get();
  return snap.docs.map((d) => {
    const p = d.data() as Partial<Profile>;
    return {
      uid: d.id,
      email: p.email ?? null,
      name: p.name ?? null,
      role: seededRole(p.email ?? null) ?? (isRole(p.role) ? p.role : null),
      assignedBy: p.assignedBy ?? null,
      assignedAt: p.assignedAt ?? null,
      createdAt: p.createdAt ?? '',
    } as Profile & { role: Role | null };
  });
}

/** Giving somebody a role. Only ever called after the caller was checked. */
export async function setRole(uid: string, role: Role | null, by: string): Promise<void> {
  await adminDb().collection(PROFILES).doc(uid).set(
    { role, assignedBy: by, assignedAt: new Date().toISOString() },
    { merge: true },
  );
}
