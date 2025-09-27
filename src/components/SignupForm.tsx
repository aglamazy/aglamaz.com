'use client';

import React, { useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/utils/apiFetch';
import { useSiteStore } from '@/store/SiteStore';
import { useTranslation } from 'react-i18next';

interface SignupFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  submitLabel?: string;
  onSubmitOverride?: (payload: { firstName: string; email: string }) => Promise<void>;
  isLoadingOverride?: boolean;
}

export default function SignupForm({
  onSuccess,
  onCancel,
  submitLabel,
  onSubmitOverride,
  isLoadingOverride,
}: SignupFormProps) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { t, i18n } = useTranslation();

  const siteId =
    useSiteStore((s) => s.siteInfo?.id) ||
    process.env.NEXT_SITE_ID ||
    'default';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !email.trim()) {
      setError(t('pleaseFillAllFields'));
      return;
    }

    const useInternalLoader = isLoadingOverride === undefined;
    if (useInternalLoader) {
      setIsLoading(true);
    }
    setError('');

    try {
      if (onSubmitOverride) {
        await onSubmitOverride({
          firstName: firstName.trim(),
          email: email.trim(),
        });
        onSuccess();
      } else {
        // Step 1: Send email verification request (no Firebase auth yet)
        const data = await apiFetch<{ success: boolean }>(
          '/api/signup/request-verification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firstName: firstName.trim(),
              email: email.trim(),
              siteId,
            }),
          },
        );
        console.log('request verification', data);

        setIsSubmitted(true);
        setEmailSent(data.success == true);
      }
    } catch (error: unknown) {
      console.error('Signup error:', error);
      if (onSubmitOverride && error instanceof Error && error.message) {
        setError(error.message);
      } else if (onSubmitOverride && typeof error === 'string') {
        setError(error);
      } else {
        setError(t('failedToSendVerification'));
      }
    } finally {
      if (useInternalLoader) {
        setIsLoading(false);
      }
    }
  };

  if (!onSubmitOverride && isSubmitted) {
    return (
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center" dir={i18n.dir()} lang={i18n.language}>
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {emailSent ? t('verificationEmailSent') : t('requestSentSuccessfully')}
          </h3>
          
          {emailSent ? (
            <>
              <p className="text-gray-600 mb-4">
                {t('checkInboxContactAdmin')}
              </p>
              <p className="text-sm text-gray-500">
                {email}
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                {t('requestSentButNoVerification')}
              </p>
              <p className="text-sm text-gray-500">
                {email}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center" dir={i18n.dir()} lang={i18n.language}>
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-4 shadow">
          {/* Placeholder for logo */}
          <span className="text-4xl">🌳</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center">{t('signUp')}</h1>
        <p className="text-gray-500 mt-2 text-center">{t('signUpToContinue')}</p>
      </div>



      {/* Error Message */}
      {error && (
        <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {/* First Name Input */}
        <div className="w-full">
          <label className="block text-gray-700 text-sm mb-1" htmlFor="firstName">{t('firstName')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t('firstNamePlaceholder') as string}
              disabled={isLoadingOverride ?? isLoading}
            />
          </div>
        </div>

        {/* Email Input */}
        <div className="w-full">
          <label className="block text-gray-700 text-sm mb-1" htmlFor="email">{t('email')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 7.5V16.5C21 18.1569 19.6569 19.5 18 19.5H6C4.34315 19.5 3 18.1569 3 16.5V7.5M21 7.5C21 5.84315 19.6569 4.5 18 4.5H6C4.34315 4.5 3 5.84315 3 7.5M21 7.5L12 13.5L3 7.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t('emailPlaceholder') as string}
              disabled={isLoadingOverride ?? isLoading}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoadingOverride ?? isLoading}
        >
          {isLoadingOverride ?? isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
              {t('sending')}
            </>
          ) : (
            submitLabel || t('submitRequest')
          )}
        </button>

        {/* Cancel Link */}
        <div className="flex justify-center w-full text-sm text-gray-500">
          <button 
            type="button"
            onClick={onCancel}
            className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoadingOverride ?? isLoading}
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
