'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { initFirebase, auth, googleProvider } from '@/firebase/client';
import { signInWithPopup, getIdToken } from 'firebase/auth';
import { useUserStore } from '@/store/UserStore';
import { apiFetch } from '@/utils/apiFetch';
import { landingPage } from "@/app/settings";
import { ApiRoute } from '@/entities/Routes';
import { useTranslation } from 'react-i18next';

interface VerifySignupClientProps {
  token: string | null;
}

type Status = 'loading' | 'token_verified' | 'signing_in' | 'success' | 'error';

export default function VerifySignupClient({ token }: VerifySignupClientProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [firstName, setFirstName] = useState('');
  const router = useRouter();
  const { setUser } = useUserStore();
  const { t, i18n } = useTranslation();

  // Step 1: Verify the token on mount (no popup)
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    (async () => {
      try {
        const data = await apiFetch<{ data?: { firstName?: string } }>(ApiRoute.AUTH_SIGNUP_VERIFY, {
          method: 'POST',
          body: { token },
        });
        if (data.data?.firstName) setFirstName(data.data.firstName);
        setStatus('token_verified');
      } catch (error) {
        console.error('Token verification failed:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Verification failed');
      }
    })();
  }, [token]);

  // Step 2: User clicks button → Google sign-in popup + complete verification
  const handleGoogleSignIn = async () => {
    setStatus('signing_in');
    try {
      initFirebase();
      if (!auth || !googleProvider) {
        throw new Error('Firebase not initialized');
      }

      const result = await signInWithPopup(auth(), googleProvider);
      const firebaseToken = await getIdToken(result.user);

      setUser({
        name: result.user.displayName,
        email: result.user.email,
        user_id: result.user.uid,
      });

      await apiFetch<void>(ApiRoute.AUTH_SIGNUP_COMPLETE_VERIFICATION, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firebaseToken}` },
        body: { token, userId: result.user.uid },
      });

      setStatus('success');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Sign-in failed');
    }
  };

  const dir = i18n.dir();

  // --- Render states ---

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center" dir={dir}>
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('verifyingYourEmail')}
          </h3>
          <p className="text-gray-600 text-center">{t('pleaseWait')}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center" dir={dir}>
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('verificationError')}</h3>
          <p className="text-gray-600 text-center mb-4">{message}</p>
          <button
            onClick={() => router.push(landingPage)}
            className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            {t('backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'token_verified' || status === 'signing_in') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center" dir={dir}>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('emailVerifiedSuccess')}
          </h3>
          <p className="text-gray-600 text-center mb-6">
            {firstName ? t('helloName', { name: firstName }) : ''}{t('signInWithGoogleToComplete')}
          </p>
          <button
            onClick={handleGoogleSignIn}
            disabled={status === 'signing_in'}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-3 font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'signing_in' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FcGoogle className="text-xl" />
            )}
            {status === 'signing_in' ? t('signingIn') : t('continueWithGoogle')}
          </button>
        </div>
      </div>
    );
  }

  // status === 'success'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center" dir={dir}>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('registrationComplete')}</h3>
        <p className="text-gray-600 text-center mb-4">
          {t('requestPendingAdminApproval')}
        </p>
        <button
          onClick={() => router.push(landingPage)}
          className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition"
        >
          {t('backToHomePage')}
        </button>
      </div>
    </div>
  );
}
