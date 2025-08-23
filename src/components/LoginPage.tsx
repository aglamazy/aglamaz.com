'use client';

import React, { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { initFirebase, auth, googleProvider } from '@/firebase/client';
import { signInWithPopup, getIdToken, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useSiteStore } from '@/store/SiteStore';
import { useUserStore } from '@/store/UserStore';
import { useLoginModalStore } from '@/store/LoginModalStore';
import SignupForm from '@/components/SignupForm';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const router = useRouter();
  const { siteInfo } = useSiteStore();
  const { setUser } = useUserStore();
  const { t } = useTranslation();
  const { close: closeLogin } = useLoginModalStore();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      initFirebase();

      if (auth && googleProvider) {
        const result = await signInWithPopup(auth(), googleProvider);
        const idToken = await getIdToken(result.user);

        const sessionRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          credentials: 'include',
        });
        if (!sessionRes.ok) throw new Error('Session creation failed');

        setUser({
          name: result.user.displayName || result.user.email,
          email: result.user.email,
          user_id: result.user.uid,
        });

        await router.replace('/');
        closeLogin();
      }
    } catch (e) {
      setError(t('googleLoginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError(t('pleaseEnterEmailPassword'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      initFirebase();
      if (auth) {
        const result = await signInWithEmailAndPassword(auth(), email, password);

        // Update user state immediately after login
        setUser({
          name: result.user.displayName || result.user.email,
          email: result.user.email,
          user_id: result.user.uid,
        });

        router.push('/');
        closeLogin();
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError(t('invalidEmailOrPassword'));
      } else if (error.code === 'auth/too-many-requests') {
        setError(t('tooManyFailedAttempts'));
      } else {
        setError(t('loginFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError(t('pleaseEnterEmailAddressFirst'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      initFirebase();
      if (auth) {
        await sendPasswordResetEmail(auth(), email);
        alert(t('passwordResetEmailSent'));
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setError(t('noAccountFoundWithThisEmail'));
      } else {
        setError(t('failedToSendResetEmail'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showSignup) {
    return (
      <SignupForm
        onSuccess={() => router.push('/pending-member')}
        onCancel={() => setShowSignup(false)}
      />
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-4 shadow">
          {/* Placeholder for logo */}
          <span className="text-4xl">🌳</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          {t('welcomeToFamilyCircle', { name: siteInfo?.name || 'FamilyCircle' })}
        </h1>
        <p className="text-gray-500 mt-2 text-center">{t('signInToContinue')}</p>
      </div>
      {/* Error Message */}
      {error && (
        <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}
      {/* Google Login */}
      <button
        className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 mb-4 font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleGoogleLogin}
        disabled={isLoading}
      >
        <FcGoogle className="text-xl" />
        {isLoading ? t('signingIn') : t('continueWithGoogle')}
      </button>
      <div className="flex items-center w-full my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="mx-2 text-gray-400 text-sm">{t('or')}</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      {/* Email Input */}
      <div className="w-full mb-3">
        <label className="block text-gray-700 text-sm mb-1" htmlFor="email">
          {t('email')}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 7.5V16.5C21 18.1569 19.6569 19.5 18 19.5H6C4.34315 19.5 3 18.1569 3 16.5V7.5M21 7.5C21 5.84315 19.6569 4.5 18 4.5H6C4.34315 4.5 3 5.84315 3 7.5M21 7.5L12 13.5L3 7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <input
            id="email"
            type="email"
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      {/* Password Input */}
      <div className="w-full mb-6">
        <label className="block text-gray-700 text-sm mb-1" htmlFor="password">
          {t('password')}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                d="M17 11V7A5 5 0 0 0 7 7v4M5 11h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <input
            id="password"
            type="password"
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      {/* Sign In Button */}
      <button
        className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleEmailLogin}
        disabled={isLoading}
      >
        {isLoading ? t('signingIn') : t('signIn')}
      </button>
      {/* Links */}
      <div className="flex justify-between w-full text-sm text-gray-500">
        <button
          onClick={handleForgotPassword}
          className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {t('forgotPassword')}
        </button>
        <Link href="/contact" className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
          {t('contactUs')}
        </Link>
        <button
          onClick={() => setShowSignup(true)}
          className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {t('signUp')}
        </button>
      </div>
    </div>
  );
}

