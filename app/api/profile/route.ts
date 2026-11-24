import { NextResponse } from 'next/server';
import { adminAvailable } from '@/src/firebase/admin.js';
import { verifiableProjectId } from '@/src/firebase/verify.js';
import { callerFrom, listProfiles, setRole } from '@/src/firebase/profiles.js';
import { ALL_ROLES, canAssignRoles, isRole, ROLE_META } from '@/src/auth/roles.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who you are, what you may judge, and — if you are allowed — who everyone
 * else is.
 *
 * The role is read from the verified token's profile, never from anything
 * the browser says about itself. The page can be lied to; this cannot.
 */
export async function GET(request: Request) {
  const caller = await callerFrom(request);
  const mayAssign = canAssignRoles(caller.role);

  return NextResponse.json({
    me: {
      uid: caller.uid,
      email: caller.email,
      name: caller.name,
      role: caller.role,
      judges: caller.role ? ROLE_META[caller.role].judges : [],
      unverified: caller.unverified,
    },
    roles: ALL_ROLES,
    canAssign: mayAssign,
    /** Only an admin or marketing sees the team; the rest see themselves. */
    people: mayAssign && !caller.unverified ? await listProfiles() : [],
    /**
     * Three honest states, not two. With a service account everything works;
     * with only the shipped project config, identity and roles are real but
     * nothing can be stored; with neither, nobody can be told apart.
     */
    identity: adminAvailable()
      ? 'verified'
      : verifiableProjectId()
        ? 'verified against Google\u2019s public keys — roles come from config/people.json, and no profile can be stored without a service account'
        : 'not verified — there is no Firebase project configured',
  });
}

export async function POST(request: Request) {
  const caller = await callerFrom(request);

  if (caller.unverified) {
    return NextResponse.json(
      {
        error:
          'Roles cannot be assigned while the server cannot verify anybody. Set up the Firebase service account first.',
      },
      { status: 409 },
    );
  }
  if (!canAssignRoles(caller.role)) {
    return NextResponse.json({ error: 'only an admin or marketing can hand out roles' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { uid?: unknown; role?: unknown };
  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!uid) return NextResponse.json({ error: 'expected uid' }, { status: 400 });

  /** null is a real answer: it takes a role away. */
  const role = body.role === null ? null : isRole(body.role) ? body.role : undefined;
  if (role === undefined) {
    return NextResponse.json(
      { error: `expected role: ${ALL_ROLES.map((r) => r.id).join(' | ')} or null` },
      { status: 400 },
    );
  }

  /**
   * Nobody takes away their own admin. Not a security rule — anyone who can
   * do this can also give it back — but it is the mistake that locks a team
   * out of its own tool, and it costs one line to refuse.
   */
  if (uid === caller.uid && role !== caller.role) {
    return NextResponse.json({ error: 'change your own role from another account' }, { status: 400 });
  }

  await setRole(uid, role, caller.email ?? caller.uid);
  return NextResponse.json({ ok: true, uid, role });
}
