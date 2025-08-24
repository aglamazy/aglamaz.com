import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
  if (!process.env.NEXT_SITE_ID) {
    throw new Error('NEXT_SITE_ID is not set');
  }
  const siteId = process.env.NEXT_SITE_ID;
  const doc = await db.collection('sites').doc(siteId).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  const plainData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      plainData[key] = value.toDate().toISOString();
    } else {
      plainData[key] = value;
    }
  }

  return { id: doc.id, ...plainData };
}
