'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, cn } from '@/components/ui/primitives';
import { useAuth } from '@/app/lib/auth';
import { authHeaders, useProfile } from '@/app/lib/profile';
import { VERDICT_LABEL, VERDICT_STAGES, type VerdictStage } from '@/app/lib/types';
import type { Role, RoleMeta } from '@/src/auth/roles';

/**
 * Who is who, and what each of them may say.
 *
 * The roles are not permissions on features — everyone can see every screen,
 * because a copywriter who cannot look at the layout cannot do their own job
 * well either. What a role decides is whose JUDGEMENT this system records,
 * and that is narrower on purpose: each verdict goes into the instructions
 * of one agent, and an opinion from outside that craft makes the evidence
 * noisier rather than richer.
 */

interface Person {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role | null;
  assignedBy: string | null;
  assignedAt: string | null;
}

interface Payload {
  me: {
    uid: string; email: string | null; name: string | null;
    role: Role | null; judges: VerdictStage[]; unverified: boolean;
  };
  roles: RoleMeta[];
  canAssign: boolean;
  people: Person[];
  identity: string;
}

export default function ProfilePage() {
  const { user, ready, configured } = useAuth();
  const { reload } = useProfile();
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/profile', { headers: await authHeaders() });
    setData((await res.json()) as Payload);
  }

  useEffect(() => { if (ready) void load(); }, [ready, user?.uid]);

  async function assign(uid: string, role: Role | null) {
    setBusy(uid);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ uid, role }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await load();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !data) {
    return (
      <main className="mx-auto max-w-[980px] px-8 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const me = data.me;

  return (
    <main className="mx-auto max-w-[980px] px-8 pb-16 pt-5">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Who you are</h1>
      <p className="mb-6 max-w-[680px] text-[13.5px] leading-relaxed text-muted-foreground">
        Everyone can open every screen. What a role decides is which verdicts this system will
        record from you — each one goes into a different agent&rsquo;s instructions, so a judgement
        from outside that craft makes the evidence noisier rather than richer.
      </p>

      {/* Said plainly when roles work but cannot be changed from this screen. */}
      {!me.unverified && !data.canAssign && data.identity.startsWith('verified against') && (
        <div className="mb-6 rounded-[11px] border bg-secondary/50 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          This copy runs without a service account, so roles are read from{' '}
          <code className="font-mono text-[12px]">config/people.json</code> and checked on every
          request, but they cannot be handed out from here — there is nothing to write them to.
        </div>
      )}

      {me.unverified && (
        <div className="mb-6 rounded-[11px] border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
          <strong>This server cannot tell anybody apart.</strong> There is no Firebase project
          configured here, so no token can be verified and no role can be enforced: everything is
          allowed and nothing is attributed — {data.identity}.
        </div>
      )}

      {!me.unverified && !user && (
        <div className="mb-6 rounded-[11px] border bg-secondary/50 px-4 py-3.5">
          <p className="text-[13px]">
            You are not signed in, so nothing you do is recorded as a judgement.{' '}
            <Link href="/sign-in" className="font-medium underline underline-offset-2">Sign in</Link>
            {' '}and ask an admin for a role.
          </p>
        </div>
      )}

      {user && (
        <section className="mb-7 overflow-hidden rounded-[12px] border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elgi-navy text-[13px] font-semibold text-white">
              {(me.email ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-[200px] flex-grow">
              <div className="text-[14.5px] font-semibold">{me.name ?? me.email ?? 'Signed in'}</div>
              <div className="text-[12.5px] text-muted-foreground">{me.email}</div>
            </div>
            {me.role ? (
              <Badge tone="navy">{roleLabel(data.roles, me.role)}</Badge>
            ) : (
              <Badge tone="amber">no role yet</Badge>
            )}
          </div>

          <div className="px-5 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              What you may judge
            </div>
            <div className="flex flex-wrap gap-2">
              {VERDICT_STAGES.map((stage) => {
                const mine = me.unverified || me.judges.includes(stage);
                return (
                  <span
                    key={stage}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12.5px]',
                      mine
                        ? 'border-lime-300 bg-lime-50 text-lime-900'
                        : 'border-input bg-secondary/40 text-muted-foreground line-through',
                    )}
                  >
                    {VERDICT_LABEL[stage]}
                  </span>
                );
              })}
            </div>
            {!me.role && !me.unverified && (
              <p className="mt-2.5 text-[12.5px] text-muted-foreground">
                Without a role you can read everything and judge nothing. Ask an admin or someone in
                marketing to give you one.
              </p>
            )}
          </div>
        </section>
      )}

      {/* The roles, said plainly, so asking for one is an informed request. */}
      <h2 className="mb-2.5 text-sm font-semibold">The roles</h2>
      <div className="mb-7 overflow-hidden rounded-[12px] border">
        {data.roles.map((role) => (
          <div key={role.id} className="flex flex-wrap gap-3 border-t px-5 py-3.5 first:border-t-0">
            <div className="min-w-[150px]">
              <div className="text-[13.5px] font-semibold">{role.label}</div>
              <div className="text-[12px] text-muted-foreground">{role.does}</div>
            </div>
            <div className="min-w-[260px] flex-grow">
              <div className="mb-1 flex flex-wrap gap-1.5">
                {VERDICT_STAGES.map((stage) => (
                  <span
                    key={stage}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11.5px]',
                      role.judges.includes(stage)
                        ? 'bg-lime-100 text-lime-800'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {VERDICT_LABEL[stage]}
                  </span>
                ))}
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">{role.because}</p>
            </div>
          </div>
        ))}
      </div>

      {data.canAssign && (
        <>
          <h2 className="mb-1 text-sm font-semibold">The team</h2>
          <p className="mb-3 text-[12.5px] text-muted-foreground">
            Everybody who has signed in. A role here is written by the server and cannot be set from
            a browser — which is the only reason it means anything.
          </p>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="overflow-hidden rounded-[12px] border">
            {data.people.length === 0 && (
              <p className="px-5 py-4 text-[12.5px] text-muted-foreground">
                Nobody else has signed in yet.
              </p>
            )}
            {data.people.map((person) => (
              <div key={person.uid} className="flex flex-wrap items-center gap-3 border-t px-5 py-3 first:border-t-0">
                <div className="min-w-[220px] flex-grow">
                  <div className="text-[13.5px]">{person.name ?? person.email ?? person.uid}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {person.email}
                    {person.assignedBy && ` · set by ${person.assignedBy}`}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => assign(person.uid, role.id)}
                      className={
                        person.role === role.id
                          ? 'rounded-full bg-elgi-navy px-2.5 py-1 text-[12px] font-medium text-white'
                          : 'rounded-full border bg-card px-2.5 py-1 text-[12px] text-slate-700 hover:border-slate-400'
                      }
                    >
                      {role.label}
                    </button>
                  ))}
                  <Button
                    variant="ghost"
                    disabled={busy !== null || !person.role}
                    onClick={() => assign(person.uid, null)}
                  >
                    None
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function roleLabel(roles: RoleMeta[], id: Role): string {
  return roles.find((r) => r.id === id)?.label ?? id;
}
