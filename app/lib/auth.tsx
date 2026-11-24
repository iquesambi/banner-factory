'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth, firebaseConfigured } from './firebase';

/**
 * Who is using the factory.
 *
 * Until now nothing in this app knew that. It did not need to: everything ran
 * on one machine against files on disk. It matters from here, because the
 * review a person gives a banner — the thumbs that will eventually feed fine
 * tuning — is worth very little without knowing whose judgement it was.
 *
 * `ready` is separate from `user` on purpose. Firebase restores a session
 * asynchronously, so for the first moment after a page load there is no user
 * AND no answer, and a screen that treats those two states the same flashes a
 * sign-in form at someone who is already signed in.
 */
interface AuthState {
  user: User | null;
  ready: boolean;
  configured: boolean;
}

const Ctx = createContext<AuthState>({ user: null, ready: false, configured: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = firebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(firebaseAuth(), (next) => {
      setUser(next);
      setReady(true);
    });
  }, [configured]);

  const value = useMemo(() => ({ user, ready, configured }), [user, ready, configured]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}

/** Google first: it is the provider the brief's own team already uses. */
export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth(), email, password);
}

export async function registerWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(firebaseAuth(), email, password);
}

export async function signOutOfApp(): Promise<void> {
  await signOut(firebaseAuth());
}

/**
 * Firebase error codes, said plainly.
 *
 * The SDK's own messages read like `Firebase: Error (auth/invalid-credential).`
 * which tells someone trying to sign in nothing at all.
 */
export function readableAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email': return 'That does not look like an email address.';
    case 'auth/missing-password': return 'Enter a password.';
    case 'auth/weak-password': return 'That password is too short — six characters at least.';
    case 'auth/email-already-in-use': return 'There is already an account with that email. Sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'That email and password do not match an account.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a minute and try again.';
    case 'auth/popup-closed-by-user': return 'The Google window was closed before signing in.';
    case 'auth/unauthorized-domain':
      return 'This address is not an authorised domain for the Firebase project.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled on the Firebase project.';
    default:
      return error instanceof Error ? error.message : 'Sign-in failed.';
  }
}

/** The initials shown in the header, from whatever the provider gave us. */
export function initialsOf(user: User): string {
  const source = user.displayName?.trim() || user.email?.trim() || '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}
