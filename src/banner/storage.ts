import { readFileSync, statSync } from 'node:fs';
import { adminAvailable, adminBucket, whyUnavailable } from '../firebase/admin.js';

/**
 * Where a finished banner lives once it exists.
 *
 * It is written to disk first and uploaded second, deliberately. The render is
 * the expensive part of the whole pipeline — a headless Chrome pass over a
 * 2048×768 canvas — and losing it to a network error would mean paying for the
 * copy and the layout again. The local file stays the source; the bucket is
 * where the banner becomes reachable by anything that is not this machine.
 *
 * An upload that cannot happen is reported, never thrown. A banner that exists
 * on disk and failed to upload is still a banner; failing the run over it
 * would throw away work that was already paid for.
 */
export const BANNER_PREFIX = 'banners';

export interface Upload {
  /** The object's path inside the bucket. */
  path: string;
  /** A URL that serves it, valid for as long as the token lives. */
  url: string;
  bytes: number;
}

export interface UploadResult {
  upload: Upload | null;
  /** Why there is no upload, in one line a person can act on. */
  skipped: string | null;
}

export function storageAvailable(): boolean {
  return adminAvailable();
}

/**
 * Uploads one rendered banner.
 *
 * The object is given a download token rather than being made public: the
 * banner names a real product at a real price, and a bucket anyone can list
 * is a different decision from a URL the app hands out.
 */
export async function uploadBanner(
  localPath: string,
  options: { name?: string; metadata?: Record<string, string> } = {},
): Promise<UploadResult> {
  if (!adminAvailable()) return { upload: null, skipped: whyUnavailable() };

  const name = options.name ?? localPath.split('/').pop()!;
  const path = `${BANNER_PREFIX}/${name}`;

  try {
    const bytes = statSync(localPath).size;
    const body = readFileSync(localPath);
    const bucket = adminBucket();
    const file = bucket.file(path);

    /**
     * A UUID token, which is what the Firebase SDKs use for download URLs.
     * Generated here so the URL can be returned from this call instead of
     * requiring a second round trip to read it back.
     */
    const token = crypto.randomUUID();
    await file.save(body, {
      resumable: false,
      contentType: 'image/png',
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: token, ...options.metadata },
      },
    });

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}`
      + `/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

    return { upload: { path, url, bytes }, skipped: null };
  } catch (error) {
    return {
      upload: null,
      skipped: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Removes one banner from the bucket. Used when a job is deleted. */
export async function deleteBanner(name: string): Promise<boolean> {
  if (!adminAvailable()) return false;
  try {
    await adminBucket().file(`${BANNER_PREFIX}/${name}`).delete();
    return true;
  } catch {
    return false;
  }
}
