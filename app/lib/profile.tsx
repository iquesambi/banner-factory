'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { firebaseAuth, firebaseConfigured } from './firebase';
import type { Role, VerdictStage } from '@/src/auth/roles';

/**
 * The signed-in person's role, as the SERVER sees it.
 *
 * Deliberately not derived from anything in the browser. The client knows
 * who is signed in; it does not get to decide what that person is allowed to
 * do, so the role is fetched with a verified token and the screen only
 * mirrors the answer. Every check that matters happens again on the server.
 */

export interface Me {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role | null;
  judges: VerdictStage[];
  /** The server cannot identify anybody, so it is letting everything through. */
  unverified: boolean;
}

interface ProfileState {
  me: Me | null;
  ready: boolean;
  reload: () => void;
}

const EMPTY: Me = { uid: '', email: null, name: null, role: null, judges: [], unverified: false };

const Ctx = createContext<ProfileState>({ me: null, ready: false, reload: () => {} });

/**
 * The bearer token for a request that needs to prove who is making it.
 *
 * `getIdToken()` refreshes it when it is close to expiring, so this is
 * called per request rather than held.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!firebaseConfigured()) return {};
  const user = firebaseAuth().currentUser;
  if (!user) return {};
  try {
    return { authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!authReady) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/profile', { headers: await authHeaders() });
        const data = (await res.json()) as { me: Me };
        if (live) setMe(data.me ?? EMPTY);
      } catch {
        if (live) setMe(EMPTY);
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, [authReady, user?.uid, tick]);

  const value = useMemo<ProfileState>(
    () => ({ me, ready, reload: () => setTick((t) => t + 1) }),
    [me, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  return useContext(Ctx);
}
