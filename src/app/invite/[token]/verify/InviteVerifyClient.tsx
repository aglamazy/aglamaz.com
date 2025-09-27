'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle, Frown } from 'lucide-react';
import { initFirebase, auth } from '@/firebase/client';
import { signInWithCustomToken } from 'firebase/auth';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';

interface InviteVerifyClientProps {
  token: string;
}

type VerifyStatus = 'loading' | 'success' | 'error';

export default function InviteVerifyClient({ token }: InviteVerifyClientProps) {
  const searchParams = useSearchParams();
  const verificationToken = searchParams?.get('code') || '';
  const { t } = useTranslation();
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [error, setError] = useState('');

  const handleSuccess = useCallback(async (
    customToken: string,
    siteId: string | undefined,
    email: string | null,
    firstName: string | null,
    needsCredentialSetup: boolean,
  ) => {
    initFirebase();
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      throw new Error('Firebase auth unavailable');
    }

    const credential = await signInWithCustomToken(firebaseAuth, customToken);
    const firebaseUser = credential.user;

    setUser({
      name: firebaseUser.displayName || firstName || firebaseUser.email || '',
      email: firebaseUser.email || email || '',
      user_id: firebaseUser.uid,
      needsCredentialSetup,
    });

    if (firebaseUser.uid && siteId) {
      await fetchMember(firebaseUser.uid, siteId);
    }

    setStatus('success');
    await router.replace(needsCredentialSetup ? '/welcome/credentials' : '/app');
  }, [fetchMember, router, setUser]);

  useEffect(() => {
    if (!verificationToken) {
      setStatus('error');
      setError(t('inviteVerifyMissingToken'));
      return;
    }

    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/invite/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteToken: token, verificationToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;

        if (!res.ok) {
          setStatus('error');
          if (data?.code === 'invite/already-verified') {
            setError(t('inviteAlreadyVerified'));
          } else {
            const message = typeof data?.error === 'string' ? data.error : t('inviteVerificationFailed');
            setError(message);
          }
          return;
        }

        await handleSuccess(
          data.customToken as string,
          data.member?.siteId ?? undefined,
          data.member?.email ?? null,
          data.member?.firstName ?? null,
          Boolean(data.needsCredentialSetup),
        );
      } catch (err) {
        if (!active) return;
        console.error('[invite-verify] unexpected failure', err);
        setStatus('error');
        setError(t('inviteVerificationFailed'));
      }
    })();

    return () => {
      active = false;
    };
  }, [handleSuccess, t, token, verificationToken]);

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center gap-4 text-sage-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>{t('inviteVerificationInProgress')}</p>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500" />
          <p className="text-lg font-semibold text-sage-700">{t('inviteVerificationSuccessTitle')}</p>
          <p className="text-sage-600">{t('inviteVerificationSuccessMessage')}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Frown className="w-12 h-12 text-red-400" />
        <p className="text-lg font-semibold text-sage-700">{t('inviteVerificationFailedTitle')}</p>
        <p className="text-sage-600">{error || t('inviteVerificationFailed')}</p>
      </div>
    );
  };

  return (
    <div className="py-16 px-4">
      <div className="max-w-lg mx-auto bg-white border border-sage-100 rounded-2xl shadow-lg p-10">
        {renderContent()}
      </div>
    </div>
  );
}
