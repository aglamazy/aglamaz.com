import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function initAdmin(): boolean {
  if (getApps().length) {
    return true;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    return false;
  }
  const privateKey = rawKey.replace(/\n/g, '\n');
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return true;
}

export const adminAuth = () => getAuth();

export async function fetchSiteInfo() {
  if (!initAdmin()) {
    return null;
  }
  if (!process.env.NEXT_SITE_ID) {
    return null;
  }
  const db = getFirestore();
  const siteId = process.env.NEXT_SITE_ID;
  const doc = await db.collection('sites').doc(siteId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}
