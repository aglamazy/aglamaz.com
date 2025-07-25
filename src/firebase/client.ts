import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
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
