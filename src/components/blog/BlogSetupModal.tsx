"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';

interface BlogSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (blogHandle: string) => void;
  userId: string;
  siteId: string;
  suggestedHandle: string;
}

export default function BlogSetupModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  siteId,
  suggestedHandle,
}: BlogSetupModalProps) {
  const { t, i18n } = useTranslation();
  const [handle, setHandle] = useState('');
  const [acceptBlogTerms, setAcceptBlogTerms] = useState(false);
  const [acceptSiteTerms, setAcceptSiteTerms] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const checkAvailability = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await apiFetch<{ available: boolean }>(
        `/api/blog/check-handle?handle=${encodeURIComponent(value)}&siteId=${siteId}`
      );
      setAvailable(result.available);
    } catch (err) {
      console.error('Failed to check handle availability', err);
      setError(t('failedToCheckAvailability') as string);
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, [siteId, t]);

  const handleChange = useCallback((value: string) => {
    // Sanitize: lowercase, alphanumeric and hyphens only
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    setHandle(sanitized);
    setAvailable(null);
    setError(null);

    // Debounce check
    const timer = setTimeout(() => {
      checkAvailability(sanitized);
    }, 500);

    return () => clearTimeout(timer);
  }, [checkAvailability]);

  // Update handle when suggestedHandle changes and check availability
  useEffect(() => {
    if (suggestedHandle && suggestedHandle !== 'user') {
      setHandle(suggestedHandle);
      // Automatically check availability for suggested handle
      checkAvailability(suggestedHandle);
    }
  }, [suggestedHandle, checkAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!handle || handle.length < 3) {
      setError(t('blogHandleTooShort') as string);
      return;
    }

    if (!acceptBlogTerms) {
      setError(t('mustAcceptBlogTerms') as string);
      return;
    }

    if (!acceptSiteTerms) {
      setError(t('mustAcceptSiteTerms') as string);
      return;
    }

    if (available !== true) {
      setError(t('blogHandleNotAvailable') as string);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/api/user/${userId}/blog/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          blogHandle: handle,
          acceptBlogTerms: true,
          acceptSiteTerms: true,
        }),
      });
      onSuccess(handle);
    } catch (err) {
      console.error('Failed to register blog', err);
      setError(t('failedToRegisterBlog') as string);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-sage-900 mb-4">
            {t('setupYourBlog')}
          </h2>

          <div className="space-y-4 mb-6">
            <div className="bg-sage-50 border border-sage-200 rounded-lg p-4">
              <h3 className="font-semibold text-sage-900 mb-2">
                {t('aboutFamilyBlog')}
              </h3>
              <p className="text-sm text-sage-700 mb-2">
                {t('blogExplanation')}
              </p>
              <ul className="text-sm text-sage-700 space-y-1 list-disc list-inside">
                <li>{t('blogFeaturePublicPrivate')}</li>
                <li>{t('blogFeatureIPProtection')}</li>
                <li>{t('blogFeatureMultilingual')}</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="blogHandle" className="block text-sm font-medium text-sage-900 mb-1">
                  {t('blogHandle')}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sage-600 text-sm">/blog/</span>
                  <input
                    id="blogHandle"
                    type="text"
                    value={handle}
                    onChange={(e) => handleChange(e.target.value)}
                    className="flex-1 border border-sage-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    placeholder="your-name"
                    minLength={3}
                    maxLength={50}
                    required
                  />
                </div>

                {checking && (
                  <p className="text-xs text-sage-600 mt-1">{t('checking')}...</p>
                )}

                {!checking && available === true && (
                  <p className="text-xs text-green-600 mt-1">✓ {t('handleAvailable')}</p>
                )}

                {!checking && available === false && (
                  <p className="text-xs text-red-600 mt-1">✗ {t('handleTaken')}</p>
                )}

                <p className="text-xs text-sage-600 mt-1">
                  {t('blogHandleNote')}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 mb-2 text-sm">
                  {t('termsAndConditions')}
                </h4>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside mb-3">
                  <li>{t('blogTermsRespectIP')}</li>
                  <li>{t('blogTermsNoHarmful')}</li>
                  <li>{t('blogTermsCompliance')}</li>
                  <li>{t('blogTermsModeration')}</li>
                </ul>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={acceptBlogTerms}
                    onChange={(e) => setAcceptBlogTerms(e.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span className="text-xs text-amber-900">
                    {t('acceptBlogTerms')}
                  </span>
                </label>
              </div>

              <div className="border border-sage-200 rounded-lg p-4">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={acceptSiteTerms}
                    onChange={(e) => setAcceptSiteTerms(e.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span className="text-xs text-sage-700">
                    {t('iHaveReadAndAccept')}{' '}
                    <a
                      href={`/${i18n.language}/terms`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sage-600 underline hover:text-sage-700"
                    >
                      {t('siteTermsAndConditions')}
                    </a>
                  </span>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  variant="outline"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !acceptBlogTerms || !acceptSiteTerms || available !== true}
                  className="bg-sage-600 hover:bg-sage-700 text-white"
                >
                  {saving ? t('creating') : t('createBlog')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
