'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/apiFetch';
import { Loader2, Save, Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';

const EditorRich = dynamic(() => import('@/components/EditorRich'), { ssr: false });

interface SiteInfo {
  id: string;
  name: string;
  aboutFamily: string;
  platformName: string;
  sourceLang: string;
  translations: Record<string, {
    name: string;
    aboutFamily: string;
    platformName: string;
    translatedAt: any;
    engine: 'gpt' | 'manual' | 'other';
  }>;
}

interface SiteResponse {
  site: SiteInfo;
}

export default function SiteDescriptionEditor() {
  const { t, i18n } = useTranslation();
  const [currentLocale, setCurrentLocale] = useState(() => (i18n.language || 'en').split('-')[0]);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [aboutFamily, setAboutFamily] = useState('');
  const [platformName, setPlatformName] = useState('');

  useEffect(() => {
    loadSiteInfo();
  }, []);

  useEffect(() => {
    const locale = (i18n.language || 'en').split('-')[0];
    setCurrentLocale(locale);
    updateFormFields(locale);
  }, [i18n.language]);

  const loadSiteInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch<SiteResponse>('/api/admin/site-description');
      setSiteInfo(data.site);
      updateFormFields((i18n.language || 'en').split('-')[0], data.site);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormFields = (locale: string, site?: SiteInfo) => {
    const info = site || siteInfo;
    if (!info) return;

    const sourceLang = info.sourceLang || 'en';

    if (locale === sourceLang) {
      // Editing source language
      setName(info.name || '');
      setAboutFamily(info.aboutFamily || '');
      setPlatformName(info.platformName || '');
    } else {
      // Editing translation
      const translation = info.translations?.[locale];
      if (translation) {
        setName(translation.name || info.name);
        setAboutFamily(translation.aboutFamily || info.aboutFamily);
        setPlatformName(translation.platformName || info.platformName);
      } else {
        // No translation yet, show source as fallback
        setName(info.name || '');
        setAboutFamily(info.aboutFamily || '');
        setPlatformName(info.platformName || '');
      }
    }
  };

  const handleSave = async (requestTranslations = false) => {
    if (!siteInfo) return;

    try {
      setSaving(true);
      setError('');
      setSaved(false);

      await apiFetch('/api/admin/site-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: currentLocale,
          name,
          aboutFamily,
          platformName,
          requestTranslations,
        }),
      });

      // Reload site info
      await loadSiteInfo();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    );
  }

  if (!siteInfo) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardContent className="py-8">
            <p className="text-red-600">{error || 'Failed to load site information'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sourceLang = siteInfo.sourceLang || 'en';
  const isEditingSource = currentLocale === sourceLang;
  const hasTranslation = Boolean(siteInfo.translations?.[currentLocale]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('editSiteDescription') || 'Edit Site Information'}</span>
            {!isEditingSource && !hasTranslation && (
              <span className="text-sm font-normal text-gray-500">
                ({t('noTranslation') || 'No translation yet'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-sage-700 mb-2">
              {t('siteName') || 'Site Name'}
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterSiteName') || 'Enter site name'}
            />
          </div>

          <div>
            <label htmlFor="platformName" className="block text-sm font-medium text-sage-700 mb-2">
              {t('platformName') || 'Platform Name'}
            </label>
            <Input
              id="platformName"
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('enterPlatformName') || 'Enter platform name (e.g., FamCircle)'}
            />
          </div>

          <div>
            <label htmlFor="aboutFamily" className="block text-sm font-medium text-sage-700 mb-2">
              {t('aboutFamily') || 'About Family'}
            </label>
            <EditorRich
              value={aboutFamily}
              locale={currentLocale}
              onChange={setAboutFamily}
            />
          </div>

          <div className="flex justify-end gap-3">
            {isEditingSource && (
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || saved}
                variant="outline"
                className="flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Languages className="w-4 h-4" />
                {t('saveAndTranslate') || 'Save & Auto-translate'}
              </Button>
            )}
            <Button
              onClick={() => handleSave(false)}
              disabled={saving || saved}
              className="flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saved && <Check className="w-4 h-4" />}
              {!saving && !saved && <Save className="w-4 h-4" />}
              {saved ? (t('saved') || 'Saved!') : (t('save') || 'Save')}
            </Button>
          </div>

          {isEditingSource && (
            <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded">
              <strong>{t('note') || 'Note'}:</strong> {t('editingSourceLanguage') || `You are editing the source language (${sourceLang}). Changes will update the original content.`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
