import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function initAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
      }),
    });
  }
}

export const adminAuth = () => getAuth();

export async function fetchSiteInfo() {
  initAdmin();
  const db = getFirestore();
  const siteId = process.env.NEXT_SITE_ID || 'default';
  const doc = await db.collection('sites').doc(siteId).get();
  return doc.exists ? doc.data() : null;
}
