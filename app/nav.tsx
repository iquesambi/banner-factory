'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/primitives';

const LINKS = [
  { href: '/', label: 'Generate' },
  { href: '/board', label: 'Board' },
  { href: '/banners', label: 'Banners' },
  { href: '/rules', label: 'Rules' },
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
        <span className="ml-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">
          IQ
        </span>
      </nav>
    </header>
  );
}
