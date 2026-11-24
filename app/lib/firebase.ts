'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase in the browser.
 *
 * The web config is not a secret: it names the project and nothing more, and
 * what actually protects the data are the Security Rules. It still comes from
 * the environment rather than the source, for the same reason every other key
 * in this project does — so that pointing the app at another project is a
 * configuration change and not an edit.
 *
 * Everything is created lazily. Next renders these modules on the server
 * during the build, where there is no browser and no need for a Firebase app,
 * and initialising at import time would run there too.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether the app was given a project to talk to.
 *
 * Checked rather than assumed, because the whole point of keeping the config
 * in the environment is that it can be absent. Every screen that touches
 * Firebase asks this first and degrades to a readable message instead of the
 * SDK's own `auth/invalid-api-key`.
 */
export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured()) {
    throw new Error('Firebase is not configured: NEXT_PUBLIC_FIREBASE_* are missing from the environment');
  }
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firebaseDb(): Firestore {
  return getFirestore(firebaseApp());
}

export function firebaseStorage(): FirebaseStorage {
  return getStorage(firebaseApp());
}
