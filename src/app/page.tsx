'use client';
import { useRouter } from 'next/navigation';
import { signInWithPopup, getIdToken } from 'firebase/auth';
import { initFirebase, auth, googleProvider, facebookProvider } from '../firebase/client';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    initFirebase();
  }, []);

  const login = async (provider: any) => {
    const result = await signInWithPopup(auth(), provider);
    const token = await getIdToken(result.user);
    document.cookie = `token=${token}; path=/`;
    router.push('/private');
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen gap-4">
      <button className="bg-blue-500 text-white px-4 py-2" onClick={() => login(googleProvider)}>
        Login with Google
      </button>
      <button className="bg-blue-700 text-white px-4 py-2" onClick={() => login(facebookProvider)}>
        Login with Facebook
      </button>
    </main>
  );
}
