'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/primitives';
import { initialsOf, signOutOfApp, useAuth } from './lib/auth';
import { useProfile } from './lib/profile';
import { ROLE_META } from '@/src/auth/roles';

const LINKS = [
  { href: '/', label: 'Generate' },
  { href: '/board', label: 'Board' },
  { href: '/banners', label: 'Banners' },
  { href: '/rules', label: 'Rules' },
  /**
   * The label is not the route. `/measure` is what the folder is called and
   * what every link in the code says; "Metrics" is what it is called on the
   * screen. Renaming the folder would churn the API routes for a word.
   */
  { href: '/measure', label: 'Metrics' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="flex flex-wrap items-center gap-6 px-8 py-3.5">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-elgi-navy">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="4" width="14" height="8" rx="1.5" stroke="#fff" strokeWidth="1.6" />
            <path d="M1 9.5L5 6.5L8.5 9" stroke="#77be24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-sm font-semibold tracking-tight">Banner Factory</span>
      </Link>

      <div className="flex-grow" />

      <nav aria-label="Main" className="flex items-center gap-1">
        {LINKS.map((l) => {
          const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          );
        })}
        <UserChip />
      </nav>
    </header>
  );
}

/**
 * Who is signed in, and the way out.
 *
 * It stays quiet while Firebase is still restoring the session: showing
 * "Sign in" for the half second before the stored user comes back reads as
 * being signed out, which is worse than showing nothing.
 */
function UserChip() {
  const { user, ready, configured } = useAuth();
  const { me } = useProfile();
  const [open, setOpen] = useState(false);

  if (!configured || !ready) return <span className="ml-1.5 h-7 w-7" aria-hidden="true" />;

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="ml-1.5 rounded-md bg-elgi-navy px-3 py-1.5 text-[13px] font-medium text-white"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative ml-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={user.email ?? undefined}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        {initialsOf(user)}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-[220px] overflow-hidden rounded-[10px] border bg-card shadow-lg">
          <div className="border-b px-3.5 py-2.5">
            <div className="truncate text-[12.5px] font-medium">{user.displayName ?? 'Signed in'}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{user.email}</div>
            {/* The role belongs next to the name: it is what this person may say. */}
            <div className="mt-1 text-[11.5px] text-elgi-navy">
              {me?.unverified
                ? 'no identity on this server'
                : me?.role
                  ? ROLE_META[me.role].label
                  : 'no role yet'}
            </div>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block w-full px-3.5 py-2.5 text-left text-[12.5px] hover:bg-secondary"
          >
            Your role and the team
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); void signOutOfApp(); }}
            className="w-full px-3.5 py-2.5 text-left text-[12.5px] hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
