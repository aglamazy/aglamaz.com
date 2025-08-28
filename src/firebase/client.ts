  import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCustomToken } from 'firebase/auth';
import { apiFetch } from '@/utils/apiFetch';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

export function initFirebase() {
  // Check if all required environment variables are present
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.error('Firebase configuration is missing. Please set up your environment variables.');
    return;
  }
  
  if (!getApps().length) {
    try {
      initializeApp(firebaseConfig);
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
    }
  }
}

export const auth = () => getAuth();
export const googleProvider = new GoogleAuthProvider();
// export const facebookProvider = new FacebookAuthProvider();

// Ensures Firebase Auth is signed in using a custom token
// derived from the app session (cookies). Always aligns identities.
export async function ensureFirebaseSignedIn(): Promise<void> {
  const a = auth();
  const { token } = await apiFetch<{ token: string }>('/api/auth/me/firebase-token', { method: 'POST' });
  await signInWithCustomToken(a, token);
}
