'use client';
import { useRouter } from 'next/navigation';
import { signInWithPopup, getIdToken } from 'firebase/auth';
import { initFirebase, auth, googleProvider, facebookProvider } from '../firebase/client';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    try {
      initFirebase();
      setIsFirebaseReady(true);
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      setIsFirebaseReady(false);
    }
  }, []);

  const login = async (provider: any) => {
    if (!isFirebaseReady) {
      alert('Firebase is not configured. Please check your environment variables.');
      return;
    }
    
    try {
      const result = await signInWithPopup(auth(), provider);
      const token = await getIdToken(result.user);
      document.cookie = `token=${token}; path=/`;
      router.push('/private');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  };

  if (!isFirebaseReady) {
    return (
      <main className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-red-500 text-center">
          <h1 className="text-xl font-bold mb-2">Configuration Error</h1>
          <p>Firebase is not properly configured.</p>
          <p className="text-sm mt-2">Please set up your Firebase environment variables in .env.local</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center h-screen gap-4">
      <button className="bg-blue-500 text-white px-4 py-2" onClick={() => login(googleProvider)}>
        Login with Google
      </button>
      <div className="text-gray-500 text-center">
        <h1 className="text-xl font-bold mb-2">Welcome</h1>
        <p>Login is temporarily disabled.</p>
      </div>
    </main>
  );
}
