'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import shipped from '@/config/firebase.json';

/**
 * Firebase in the browser.
 *
 * The config comes from `config/firebase.json`, which is in the repository,
 * so that whoever clones this talks to the SAME project — the same products,
 * the same accounts — instead of having to stand one up before the app does
 * anything. The environment still wins where it is set, for pointing a
 * deployment somewhere else.
 *
 * This half of Firebase is not a secret. It names the project and nothing
 * more, every web app ships it in its bundle, and what protects the data is
 * the Security Rules plus Authentication. The private half, the
 * service-account key, is not in the repository and is not needed to run any
 * of this.
 *
 * Everything is created lazily. Next renders these modules on the server
 * during the build, where there is no browser and no need for a Firebase app,
 * and initialising at import time would run there too.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? shipped.config.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? shipped.config.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? shipped.config.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? shipped.config.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? shipped.config.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? shipped.config.appId,
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

