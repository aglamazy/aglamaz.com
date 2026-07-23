'use client';

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { getApiPath } from '@/utils/urls';
import { ApiRoute } from '@/entities/Routes';
import { useSiteStore } from '@/store/SiteStore';
import { useSpamProtection } from '@/hooks/useSpamProtection';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GrowthSignupForm() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { honeyputInputProps, getSubmissionMetadata, resetProtection } = useSpamProtection('growth_signup_honeyput');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!emailPattern.test(trimmedEmail)) {
      setError(t('invalidEmail') as string);
      return;
    }

    const siteId = useSiteStore.getState().siteInfo?.id;
    if (!siteId) {
      setError(t('growthSignupError') as string);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const { honeyputValue, timeToSubmitMs } = getSubmissionMetadata();
      // Deliberately native fetch, not apiFetch: anonymous visitors on the
      // marketing page have no logged-in session to attach 401-refresh logic to.
      const url = getApiPath(ApiRoute.SITE_GROWTH_SIGNUP, siteId);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, locale: i18n.language, honeyputValue, timeToSubmitMs }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Growth signup error:', err);
      setError(t('growthSignupError') as string);
    } finally {
      setIsLoading(false);
      resetProtection();
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-4">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="text-sage-700 font-medium">{t('growthSignupSuccess')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <h3 className="text-xl font-bold text-charcoal mb-2 text-center">{t('growthSignupTitle')}</h3>
      <p className="text-sage-600 mb-4 text-center">{t('growthSignupDescription')}</p>
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
          {error}
        </div>
      )}
      <input type="text" {...honeyputInputProps} />
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder') as string}
          disabled={isLoading}
          className="flex-1"
          aria-label={t('email') as string}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
              {t('sending')}
            </>
          ) : (
            t('growthSignupButton')
          )}
        </Button>
      </div>
    </form>
  );
}
