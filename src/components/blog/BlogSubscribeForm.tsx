'use client';

import { useState } from 'react';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useSpamProtection } from '@/hooks/useSpamProtection';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BlogSubscribeForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { honeyputInputProps, getSubmissionMetadata, resetProtection } = useSpamProtection('blog_subscribe_honeyput');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!emailPattern.test(trimmedEmail)) {
      setError(t('invalidEmail') as string);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const { honeyputValue, timeToSubmitMs } = getSubmissionMetadata();
      await apiFetch<void>(ApiRoute.SITE_BLOG_SUBSCRIBE, {
        method: 'POST',
        body: { email: trimmedEmail, honeyputValue, timeToSubmitMs },
      });
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(t('blogSubscribeError') as string);
    } finally {
      setIsLoading(false);
      resetProtection();
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white/90">
      <CardContent className="p-5">
        {success ? (
          <div className="text-center py-2">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sage-700 font-medium">{t('blogSubscribeSuccess')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 mb-1 justify-center">
              <Mail className="w-5 h-5 text-sage-600" />
              <h3 className="text-lg font-bold text-charcoal">{t('blogSubscribeTitle')}</h3>
            </div>
            <p className="text-sage-600 mb-3 text-center text-sm">{t('blogSubscribeDescription')}</p>
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
                  t('blogSubscribeButton')
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
