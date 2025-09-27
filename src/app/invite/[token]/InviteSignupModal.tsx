'use client';

import { useState, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import SignupForm from '@/components/SignupForm';
import { useTranslation } from 'react-i18next';

interface InviteSignupModalProps {
  token: string;
  onSubmitted?: () => void;
}

export default function InviteSignupModal({ token, onSubmitted }: InviteSignupModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'form' | 'success'>('form');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const { t, i18n } = useTranslation();

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
        const response = await fetch(`/api/invite/${token}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: firstName, email, token, language: i18n.language }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
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
    <Modal isOpen={isOpen} onClose={handleCancel} isClosable={view === 'success'}>
      {view === 'success' ? (
        <div className="space-y-6 text-center">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-sage-700">{t('inviteCheckEmailTitle')}</h2>
            <p className="text-sage-600">{t('inviteCheckEmailDescription')}</p>
            {submittedEmail ? (
              <p className="text-sm text-sage-500">{submittedEmail}</p>
            ) : null}
            <p className="text-sm text-sage-500">{t('inviteCheckEmailHint')}</p>
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
