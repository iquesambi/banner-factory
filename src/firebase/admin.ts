import { readFileSync } from 'node:fs';
import { cert, getApp, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Firebase from the server, and the single place that knows how to log in.
 *
 * The browser half of this app needs only the public web config. This half —
 * the CLIs that tag the catalogue and the Next server that runs the workflows
 * — writes to Firestore and Storage, which needs a real credential. There are
 * three ways to give it one and no good reason to make callers care which:
 *
 *   FIREBASE_SERVICE_ACCOUNT          inline JSON, for a deployed environment
 *   GOOGLE_APPLICATION_CREDENTIALS    a path to the key file, for a machine
 *   application default credentials   `gcloud auth application-default login`
 *
 * None configured is a normal state, not an error. Everything this project
 * does works against local files, and Firebase is where that data is MIRRORED
 * to; a missing credential means the mirror is skipped and said out loud, not
 * that a tagging run fails.
 */
export type CredentialKind = 'inline' | 'file' | 'default' | 'none';

export function credentialKind(): CredentialKind {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return 'inline';
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return 'file';
  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) return 'default';
  return 'none';
}

export function projectId(): string | null {
  return (
    process.env.FIREBASE_PROJECT_ID
    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? process.env.GOOGLE_CLOUD_PROJECT
    ?? null
  );
}

export function storageBucket(): string | null {
  return (
    process.env.FIREBASE_STORAGE_BUCKET
    ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? null
  );
}

/** Whether a server-side write can be attempted at all. */
export function adminAvailable(): boolean {
  return credentialKind() !== 'none' && projectId() !== null;
}

/** One line a human can act on, used wherever a mirror is skipped. */
export function whyUnavailable(): string {
  if (!projectId()) return 'no Firebase project id in the environment';
  return 'no server credential: set GOOGLE_APPLICATION_CREDENTIALS to a service account key file';
}

const APP_NAME = 'banner-factory-admin';

export function adminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const project = projectId();
  if (!project) throw new Error(whyUnavailable());

  const bucket = storageBucket() ?? undefined;
  const kind = credentialKind();

  if (kind === 'inline') {
    const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!) as Record<string, string>;
    return initializeApp(
      { credential: cert(json as never), projectId: project, storageBucket: bucket },
      APP_NAME,
    );
  }
  if (kind === 'file') {
    const json = JSON.parse(
      readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8'),
    ) as Record<string, string>;
    return initializeApp(
      { credential: cert(json as never), projectId: project, storageBucket: bucket },
      APP_NAME,
    );
  }
  if (kind === 'default') {
    return initializeApp(
      { credential: applicationDefault(), projectId: project, storageBucket: bucket },
      APP_NAME,
    );
  }
  throw new Error(whyUnavailable());
}

export function adminDb(): Firestore {
  const db = getFirestore(adminApp());
  try {
    // Undefined fields are normal in this data — a product with no brand, a
    // banner with no rating — and the default behaviour is to throw on them.
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* settings() throws if the instance has already been used; that is fine. */
  }
  return db;
}

export function adminBucket() {
  const bucket = storageBucket();
  if (!bucket) throw new Error('no storage bucket in the environment');
  return getStorage(adminApp()).bucket(bucket);
}

export { getApp };
