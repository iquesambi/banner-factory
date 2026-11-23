'use client';

import { cn } from '@/components/ui/primitives';
import type { Job } from '@/app/lib/types';

/**
 * The rendered banner, at whatever width it is given.
 *
 * It is a real PNG produced by headless Chrome, not a CSS recreation, so what
 * the board shows is what would be published. `img` rather than next/image on
 * purpose: the file is served from our own route and is already exactly
 * 2048 × 768, so there is nothing for an optimiser to do.
 */
export function BannerThumb({ job, className }: { job: Job; className?: string }) {
  if (!job.png) return null;
  return (
    <img
      src={`/api/banners/${encodeURIComponent(job.png)}`}
      alt={`Banner for ${job.pick?.name ?? job.seed.name}`}
      width={2048}
      height={768}
      className={cn('block w-full', className)}
    />
  );
}
