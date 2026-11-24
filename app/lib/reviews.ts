'use client';

import {
  collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc, where,
} from 'firebase/firestore';
import { firebaseConfigured, firebaseDb } from './firebase';

/**
 * A person's verdict on one banner, in Firestore.
 *
 * The job file on disk already records a rating, and that stays: it belongs
 * with the brief that produced the banner, which is what makes the set usable
 * for fine tuning later. What the file cannot record is WHO judged it — it is
 * written by the server, which has no idea who is looking at the screen.
 *
 * So this is the same verdict with an author on it. Written from the browser
 * as the signed-in user, which is also what makes the Security Rules able to
 * say anything: `request.auth.uid` is a fact the client cannot forge, while a
 * uid posted to our own API would just be a claim.
 *
 * The document id is `{uid}_{jobId}`, so one person has exactly one verdict
 * per banner and changing their mind overwrites it instead of piling up.
 */
export const REVIEWS = 'reviews';

export interface Review {
  uid: string;
  jobId: string;
  /** Which of the three judgements this is: choice, copy or layout. */
  stage: string;
  bannerPath?: string;
  rating: 'up' | 'down';
  createdAt: string;
}

/** One verdict per person per STAGE per banner, so changing your mind replaces it. */
const idOf = (uid: string, jobId: string, stage: string) => `${uid}_${jobId}_${stage}`;

/**
 * Records a verdict, or clears it.
 *
 * Returns whether it reached Firestore. The caller treats a false as
 * cosmetic: the rating is saved on the job either way, and a signed-out
 * person rating a banner is a perfectly reasonable thing to allow — it just
 * does not get an author.
 */
export async function saveReview(
  uid: string | null,
  jobId: string,
  rating: 'up' | 'down' | null,
  stage: string,
  bannerPath: string | null,
): Promise<boolean> {
  if (!uid || !firebaseConfigured()) return false;
  try {
    const ref = doc(firebaseDb(), REVIEWS, idOf(uid, jobId, stage));
    if (rating === null) {
      await deleteDoc(ref);
      return true;
    }
    // Only the fields the rules allow, and only when they have a value: an
    // explicit `undefined` is a field as far as `hasOnly` is concerned.
    const review: Review = { uid, jobId, stage, rating, createdAt: new Date().toISOString() };
    if (bannerPath) review.bannerPath = bannerPath;
    await setDoc(ref, review);
    return true;
  } catch {
    // A rules rejection or an offline browser must not cost the person their
    // rating; it is already on the job.
    return false;
  }
}

/** Everything this person has judged, newest first. */
export async function myReviews(uid: string, max = 200): Promise<Review[]> {
  if (!firebaseConfigured()) return [];
  const q = query(
    collection(firebaseDb(), REVIEWS),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Review);
}
