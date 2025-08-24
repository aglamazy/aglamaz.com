'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { initFirebase, auth, googleProvider } from '../../../firebase/client';
import { signInWithPopup, getIdToken } from 'firebase/auth';
import { useUserStore } from '../../../store/UserStore';
import { apiFetch } from '@/utils/apiFetch';
import { landingPage } from "@/app/settings";

export default function VerifySignupPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useUserStore();

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        // Step 1: Verify the token with the server
        await apiFetch<void>('/api/signup/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token })
        });

        // Step 2: Authenticate with Firebase
        initFirebase();
        if (!auth || !googleProvider) {
          throw new Error('Firebase not initialized');
        }

        const result = await signInWithPopup(auth(), googleProvider);
        const firebaseToken = await getIdToken(result.user);

        // Update user state
        const userData = {
          name: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          uid: result.user.uid
        };
        setUser(userData);

        // Step 3: Complete the verification with user ID
        await apiFetch<void>('/api/signup/complete-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firebaseToken}`
          },
          body: JSON.stringify({
            token,
            userId: result.user.uid
          })
        });

        setStatus('success');
        setMessage('Email verified successfully! Your request is now pending admin approval.');

        // Redirect to app after 3 seconds
        setTimeout(() => {
          router.push('/app');
        }, 3000);

      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Verification failed');
      }
    };

    verifyToken();
  }, [searchParams, router, setUser]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            מאמת את האימייל שלך
          </h3>
          <p className="text-gray-600 text-center">
            אנא המתן...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            שגיאה באימות
          </h3>
          <p className="text-gray-600 text-center mb-4">
            {message}
          </p>
          <button
            onClick={() => router.push(landingPage)}
            className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            חזור לדף הכניסה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          אימות הושלם בהצלחה
        </h3>
        <p className="text-gray-600 text-center mb-4">
          {message}
        </p>
        <p className="text-sm text-gray-500 text-center">
          מעביר אותך לדף המתנה...
        </p>
      </div>
    </div>
  );
} 