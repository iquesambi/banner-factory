'use client';

import { useState } from 'react';
import { cn } from '@/components/ui/primitives';

/**
 * The product photograph from the feed, with a placeholder underneath.
 *
 * Plain `img` rather than `next/image`: these come straight off the
 * Elgiganten CDN at whatever size it serves, there is no loader configured
 * for that host, and the thumbnails here are small enough that optimising
 * them would cost more than it saves.
 *
 * The photographs sit on white in the feed, which is why the box keeps a
 * light background — a cut-out happens only in the banner renderer, where it
 * is needed.
 */
export function PhotoBox({
  src,
  alt = '',
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const shell = cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white', className);

  if (!src || broken) {
    return (
      <span className={cn(shell, 'bg-secondary')}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="#cbd5e1" strokeWidth="1.5" />
          <path
            d="M2.5 12.5l4-3.5 4 3.2 3-2.2 4 3"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={shell}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-full w-full object-contain p-0.5"
      />
    </span>
  );
}
