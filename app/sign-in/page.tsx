'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/primitives';
import {
  readableAuthError, registerWithEmail, signInWithEmail, signInWithGoogle, useAuth,
} from '@/app/lib/auth';

type Mode = 'in' | 'up';

export default function SignInPage() {
  const router = useRouter();
  const { user, ready, configured } = useAuth();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Already signed in? Leave.
   *
   * In an effect, not in the render. Navigating is a side effect on the
   * router, and doing it while this component is still rendering means
   * asking React to update one component in the middle of another — which
   * is exactly what it warned about. The effect runs after this render has
   * committed, which is the moment the redirect is safe.
   */
  const leaving = ready && Boolean(user);
  useEffect(() => {
    if (leaving) router.replace('/');
  }, [leaving, router]);

  if (leaving) {
    return (
      <main className="mx-auto max-w-[420px] px-8 py-16">
        <p className="text-sm text-muted-foreground">Already signed in — taking you back…</p>
      </main>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.replace('/');
    } catch (e) {
      setError(readableAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-[420px] flex-col justify-center px-8 pb-20">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-[13.5px] leading-relaxed text-muted-foreground">
        A banner carries a judgement about a customer, and a review of one carries a judgement about
        the banner. Both are worth knowing the author of.
      </p>

      {!configured && (
        <div className="rounded-[11px] border border-orange-200 bg-orange-50 px-4 py-3.5 text-[13px] leading-relaxed text-orange-900">
          Firebase is not configured. Set the <code className="font-mono text-[12px]">NEXT_PUBLIC_FIREBASE_*</code>{' '}
          variables in <code className="font-mono text-[12px]">.env</code> and restart the dev server.
        </div>
      )}

      {configured && (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void run(signInWithGoogle)}
            className="mb-4 w-full justify-center gap-2.5"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
              <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
              <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
            </svg>
            Continue with Google
          </Button>

          <div className="mb-4 flex items-center gap-3">
            <span className="h-px flex-grow bg-border" />
            <span className="text-[11.5px] uppercase tracking-wide text-muted-foreground">or</span>
            <span className="h-px flex-grow bg-border" />
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => (mode === 'in' ? signInWithEmail(email, password) : registerWithEmail(email, password)));
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-elgi-navy"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">Password</span>
              <input
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-elgi-navy"
              />
            </label>

            {error && (
              <p role="alert" className="text-[12.5px] leading-relaxed text-orange-800">{error}</p>
            )}

            <Button type="submit" disabled={busy} className="mt-1 w-full justify-center">
              {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create the account'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }}
            className="mt-4 text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {mode === 'in' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
          </button>
        </>
      )}
    </main>
  );
}
