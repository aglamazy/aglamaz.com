'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2, ShieldCheck, LogIn } from 'lucide-react';
import { initFirebase, auth, googleProvider } from '@/firebase/client';
import { linkWithPopup, updatePassword } from 'firebase/auth';
import { useUserStore } from '@/store/UserStore';

export default function CredentialSetupClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const checkAuth = useUserStore((state) => state.checkAuth);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    if (!user) {
      checkAuth().catch(() => {});
      return;
    }

    if (user.needsCredentialSetup === false) {
      router.replace('/app');
    }
  }, [checkAuth, router, user]);

  const validatePassword = useCallback(() => {
    if (password.trim().length < 8) {
      setPasswordError(t('credentialSetupPasswordTooShort'));
      return false;
    }
    if (password !== confirmPassword) {
      setPasswordError(t('credentialSetupPasswordMismatch'));
      return false;
    }
    setPasswordError('');
    return true;
  }, [confirmPassword, password, t]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validatePassword()) return;

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      initFirebase();
      const firebaseAuth = auth();
      if (!firebaseAuth) {
        throw new Error(t('credentialSetupFirebaseUserMissing'));
      }
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error(t('credentialSetupFirebaseUserMissing'));
      }

      await updatePassword(currentUser, password);

      const res = await fetch('/api/auth/credentials/password', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : t('credentialSetupPasswordFailed'));
      }

      await checkAuth();
      setPasswordSuccess(t('credentialSetupPasswordSuccess'));
      setTimeout(() => {
        router.replace('/app');
      }, 800);
    } catch (error) {
      console.error('[credentials][password] failed', error);
      const message = error instanceof Error ? error.message : t('credentialSetupPasswordFailed');
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleGoogleLink = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      initFirebase();
      const firebaseAuth = auth();
      if (!firebaseAuth) {
        throw new Error('Firebase unavailable');
      }
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error(t('credentialSetupFirebaseUserMissing'));
      }

      try {
        await linkWithPopup(currentUser, googleProvider);
      } catch (err: any) {
        if (err?.code === 'auth/provider-already-linked') {
          // Already linked, continue
        } else if (err?.code === 'auth/credential-already-in-use') {
          throw new Error(t('credentialSetupGoogleAlreadyUsed'));
        } else {
          throw err;
        }
      }

      const res = await fetch('/api/auth/credentials/google', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : t('credentialSetupGoogleFailed'));
      }

      await checkAuth();
      router.replace('/app');
    } catch (error) {
      console.error('[credentials][google] failed', error);
      const message = error instanceof Error ? error.message : t('credentialSetupGoogleFailed');
      setGoogleError(message);
      setGoogleLoading(false);
      return;
    }
  };

  return (
    <div className="py-16 px-4">
      <div className="max-w-4xl mx-auto bg-white border border-sage-100 rounded-2xl shadow-lg p-10 space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-sage-700">{t('credentialSetupTitle')}</h1>
          <p className="text-sage-600">{t('credentialSetupSubtitle')}</p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 border border-sage-100 rounded-xl p-6">
            <div className="flex items-center gap-3 text-sage-700">
              <ShieldCheck className="w-6 h-6" />
              <h2 className="font-semibold text-lg">{t('credentialSetupPasswordTitle')}</h2>
            </div>
            <p className="text-sm text-sage-600">{t('credentialSetupPasswordDescription')}</p>
            <div>
              <label className="block text-sm font-medium text-sage-700" htmlFor="cred-password">
                {t('credentialSetupPasswordLabel')}
              </label>
              <input
                id="cred-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-300"
                placeholder={t('credentialSetupPasswordPlaceholder') as string}
                disabled={passwordLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-700" htmlFor="cred-password-confirm">
                {t('credentialSetupPasswordConfirmLabel')}
              </label>
              <input
                id="cred-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-300"
                placeholder={t('credentialSetupPasswordConfirmPlaceholder') as string}
                disabled={passwordLoading}
              />
            </div>
            <p className="text-xs text-sage-500">{t('credentialSetupPasswordHint')}</p>
            {passwordError ? (
              <p className="text-sm text-red-600">{passwordError}</p>
            ) : null}
            {passwordSuccess ? (
              <p className="text-sm text-emerald-600">{passwordSuccess}</p>
            ) : null}
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sage-600 px-4 py-2 font-semibold text-white transition hover:bg-sage-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('credentialSetupPasswordSubmitting')}
                </span>
              ) : (
                t('credentialSetupPasswordSubmit')
              )}
            </button>
          </form>
          <div className="flex flex-col gap-4 border border-sage-100 rounded-xl p-6">
            <div className="flex items-center gap-3 text-sage-700">
              <LogIn className="w-6 h-6" />
              <h2 className="font-semibold text-lg">{t('credentialSetupGoogleTitle')}</h2>
            </div>
            <p className="text-sm text-sage-600">{t('credentialSetupGoogleDescription')}</p>
            {googleError ? (
              <p className="text-sm text-red-600">{googleError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleGoogleLink}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-sage-200 bg-white px-4 py-2 font-semibold text-sage-700 transition hover:bg-sage-50 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={googleLoading}
            >
              {googleLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('credentialSetupGoogleLinking')}
                </span>
              ) : (
                t('credentialSetupGoogleButton')
              )}
            </button>
            <p className="text-xs text-sage-500">{t('credentialSetupGoogleHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
