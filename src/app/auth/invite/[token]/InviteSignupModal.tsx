'use client';

import { useState, useCallback, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import SignupForm from '@/components/SignupForm';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';

interface InviteSignupModalProps {
  token: string;
  onSubmitted?: () => void;
}

export default function InviteSignupModal({ token, onSubmitted }: InviteSignupModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'form' | 'success' | 'already-member' | 'checking'>('checking');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [countdown, setCountdown] = useState(5);
  const { t, i18n } = useTranslation();

  // Check if user is already logged in and a member
  useEffect(() => {
    const checkExistingMembership = async () => {
      try {
        // Try to get current user info
        const userData = await apiFetch<{ user_id: string; siteId: string }>(ApiRoute.AUTH_INVITE_ME);

        // If we got user data, check if they're a member of this invite's site
        if (userData.user_id && userData.siteId) {
          // Fetch invite details to get siteId
          const inviteData = await apiFetch<{ invite: { siteId: string } }>(ApiRoute.AUTH_INVITE_BY_TOKEN, {
            pathParams: { token },
          });

          // If user's siteId matches the invite's siteId, they're already a member
          if (userData.siteId === inviteData.invite.siteId) {
            setView('already-member');
            return;
          }
        }
      } catch (error) {
        // User is not logged in or error occurred, show the form
        console.log('[invite][modal] User not logged in or not a member, showing form');
      }

      // Show the signup form
      setView('form');
    };

    checkExistingMembership();
  }, [token]);

  // Countdown timer for already-member view
  useEffect(() => {
    if (view === 'already-member') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        window.location.href = '/app';
      }
    }
  }, [view, countdown]);

  const handleSuccess = useCallback(() => {
    setView('success');
    if (onSubmitted) {
      onSubmitted();
    }
  }, [onSubmitted]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSubmitOverride = useCallback(
    async ({ firstName, email }: { firstName: string; email: string }) => {
      setIsSubmitting(true);
      try {
        // Unauthenticated invite registration uses plain fetch; no token handling needed
        // eslint-disable-next-line no-restricted-globals
        const response = await fetch(`/api/invite/${token}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: firstName, email, token, language: i18n.language }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          // Check if user is already a member
          if (data?.code === 'invite/already-member') {
            setView('already-member');
            return;
          }
          const message = typeof data?.error === 'string' ? data.error : t('inviteAcceptFailed');
          throw new Error(message);
        }

        setSubmittedEmail(email);
        setView('success');
      } catch (error) {
        console.error('[invite][modal] register failed', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(t('inviteAcceptFailed'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [token, t],
  );

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} isClosable={view === 'success' || view === 'already-member'}>
      {view === 'checking' ? (
        <div className="space-y-6 text-center py-8">
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 border-4 border-sage-200 border-t-sage-600 rounded-full animate-spin"></div>
            <p className="text-sage-600 dark:text-sage-300">{t('inviteChecking')}</p>
          </div>
        </div>
      ) : view === 'already-member' ? (
        <div className="space-y-6 text-center">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-sage-700 dark:text-sage-100">{t('inviteAlreadyMemberTitle')}</h2>
            <p className="text-sage-600 dark:text-sage-300">{t('inviteAlreadyMemberMessage')}</p>
            <p className="text-sage-500 dark:text-sage-400">
              {t('redirectingToApp')} <span className="font-semibold text-sage-700 dark:text-sage-200">{countdown}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.href = '/app'}
            className="w-full rounded-lg bg-sage-600 py-2 text-white font-semibold hover:bg-sage-700 transition"
          >
            {t('goNow')}
          </button>
        </div>
      ) : view === 'success' ? (
        <div className="space-y-6 text-center">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-sage-700 dark:text-sage-100">{t('inviteCheckEmailTitle')}</h2>
            <p className="text-sage-600 dark:text-sage-300">{t('inviteCheckEmailDescription')}</p>
            {submittedEmail ? (
              <p className="text-sm text-sage-500 dark:text-sage-400">{submittedEmail}</p>
            ) : null}
            <p className="text-sm text-sage-500 dark:text-sage-400">{t('inviteCheckEmailHint')}</p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full rounded-lg bg-sage-600 py-2 text-white font-semibold hover:bg-sage-700 transition"
          >
            {t('close')}
          </button>
        </div>
      ) : (
        <SignupForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          submitLabel={t('inviteJoinCallToAction')}
          onSubmitOverride={handleSubmitOverride}
          isLoadingOverride={isSubmitting}
        />
      )}
    </Modal>
  );
}
