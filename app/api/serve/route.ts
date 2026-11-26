import { NextResponse } from 'next/server';
import { getJob, listJobs, publishedImages } from '@/app/lib/jobs.js';
import {
  liveFor, loadExperiments, loadTraffic, record, saveTraffic,
} from '@/src/experiment/index.js';
import { cors, preflight } from '@/app/lib/cors.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Which banner to show, and the impression that goes with showing it.
 *
 * A site asks for a product in a language and gets back one banner. When a
 * test is running on that product the two arms are split evenly here, which
 * is the only place the split can honestly live: a caller that chose its own
 * side would be the thing being measured.
 *
 * The impression is recorded as part of answering, so an impression cannot
 * be forgotten by whoever integrates this; the click is theirs to report.
 */
export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sku = url.searchParams.get('sku')?.trim() ?? '';
  const language = url.searchParams.get('lang')?.trim() || 'da';
  if (!sku) return cors(NextResponse.json({ error: 'expected ?sku=' }, { status: 400 }));

  /**
   * The newest PUBLISHED banner for this product in this language.
   *
   * A banner that was made but not published is not refused by accident: it
   * was never put out, so there is nothing here for a visitor to be shown,
   * and an impression recorded against it would be a number nobody can see
   * on the metrics page.
   */
  const live = publishedImages();
  const control = listJobs().find(
    (j) => j.png && live.has(j.png) && j.brief && !j.variant
      && j.language === language && j.brief.product.sku === sku,
  );
  if (!control) {
    return cors(NextResponse.json({ error: 'no published banner for that product' }, { status: 404 }));
  }

  const experiment = liveFor(loadExperiments(), control.id);
  const variant = experiment?.state === 'running' && experiment.variantJobId
    ? getJob(experiment.variantJobId)
    : null;

  const useVariant = Boolean(variant?.png) && Math.random() < 0.5;
  const shown = useVariant ? variant! : control;

  saveTraffic(record(loadTraffic(), shown.id, 'impression', false));

  return cors(NextResponse.json({
    /** The product on it, so a tag knows where a click should land. */
    sku: shown.brief?.product.sku ?? sku,
    jobId: shown.id,
    arm: useVariant ? 'variant' : 'control',
    experimentId: experiment?.id ?? null,
    image: `/api/banners/${encodeURIComponent(shown.png as string)}`,
    /** Post this back with { jobId, event: 'click' } when somebody follows it. */
    click: '/api/track',
  }));
}
