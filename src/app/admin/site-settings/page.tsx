'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, Save, Mail } from 'lucide-react';
import { useSiteStore } from '@/store/SiteStore';
import type { ISite } from '@/entities/Site';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function SiteSettingsPage() {
  const { t } = useTranslation();
  const site = useSiteStore((state) => state.siteInfo) as ISite | null;
  const [aboutFamily, setAboutFamily] = useState('');
  const [sourceLang, setSourceLang] = useState('he');
  const [defaultLocale, setDefaultLocale] = useState('he');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewSending, setPreviewSending] = useState(false);
  const [previewResult, setPreviewResult] = useState('');
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!site?.id) return;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{
          aboutFamily: string;
          sourceLang: string;
          defaultLocale: string | null;
          aboutTranslations: Record<string, string>;
        }>(ApiRoute.SITE_SETTINGS);
        setAboutFamily(data.aboutFamily || '');
        setSourceLang(data.sourceLang || 'he');
        setDefaultLocale(data.defaultLocale || 'he');
      } catch (err) {
        console.error('Failed to load site settings', err);
        setError(t('failedToLoadSettings'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [site?.id, t]);

  const handleSave = async () => {
    if (!site?.id) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await apiFetch(ApiRoute.SITE_SETTINGS, {
        method: 'PUT',
        body: { aboutFamily, sourceLang, defaultLocale },
      });
      setSuccessMessage(t('settingsSavedSuccessfully'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
      setError(t('failedToSaveSettings'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendPreview = async () => {
    if (!site?.id) return;
    setPreviewSending(true);
    setPreviewError('');
    setPreviewResult('');
    try {
      const result = await apiFetch<{ sentTo: string }>(ApiRoute.SITE_DIGEST_PREVIEW_SEND, {
        method: 'POST',
      });
      setPreviewResult(t('digestPreviewSent', { email: result.sentTo }) || `Preview sent to ${result.sentTo}`);
      setTimeout(() => setPreviewResult(''), 6000);
    } catch (err) {
      console.error('Failed to send digest preview', err);
      setPreviewError(t('digestPreviewFailed') || 'Failed to send preview');
    } finally {
      setPreviewSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Settings size={32} className="text-sage-600" />
            <h1 className="text-3xl font-bold text-sage-700">{t('siteSettings')}</h1>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-sage-600">{t('loading')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Settings size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">{t('siteSettings')}</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <label className="block mb-2 text-lg font-semibold text-sage-700">
                {t('aboutFamily')}
              </label>
              <p className="text-sm text-sage-600 mb-3">
                {t('aboutFamilyDescription')}
              </p>
              <textarea
                value={aboutFamily}
                onChange={(e) => setAboutFamily(e.target.value)}
                className="w-full p-3 border border-sage-200 rounded-md min-h-[200px] focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                placeholder={t('aboutFamilyPlaceholder')}
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-sage-700">
                {t('sourceLanguage')}
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full sm:w-auto p-2 border border-sage-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              >
                <option value="he">{t('hebrew')}</option>
                <option value="en">{t('english')}</option>
                <option value="tr">{t('turkish')}</option>
              </select>
              <p className="text-xs text-sage-500 mt-1">
                {t('sourceLanguageHint')}
              </p>
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-sage-700">
                {t('defaultLocale')}
              </label>
              <select
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
                className="w-full sm:w-auto p-2 border border-sage-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              >
                <option value="he">{t('hebrew')}</option>
                <option value="en">{t('english')}</option>
                <option value="tr">{t('turkish')}</option>
              </select>
              <p className="text-xs text-sage-500 mt-1">
                {t('defaultLocaleHint')}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? t('saving') : t('save')}
              </Button>

              {successMessage && (
                <p className="text-green-600 text-sm">{successMessage}</p>
              )}
              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-sage-200">
              <label className="block mb-2 text-lg font-semibold text-sage-700">
                {t('digestPreview') || 'Preview the family magazine'}
              </label>
              <p className="text-sm text-sage-600 mb-3">
                {t('digestPreviewDescription') || "Emails you a preview of who would receive the digest and in which language, plus a content sample - doesn't send to anyone else and doesn't count as a real send."}
              </p>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleSendPreview}
                  disabled={previewSending}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Mail size={16} />
                  {previewSending ? (t('sending') || 'Sending...') : (t('sendDigestPreview') || 'Send me a preview')}
                </Button>
                {previewResult && (
                  <p className="text-green-600 text-sm">{previewResult}</p>
                )}
                {previewError && (
                  <p className="text-red-600 text-sm">{previewError}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
