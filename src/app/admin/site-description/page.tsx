'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { Loader2, Save, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';

const EditorRich = dynamic(() => import('@/components/EditorRich'), { ssr: false });

interface SiteDescription {
  title: string;
  content: string;
  translations: Record<string, { title: string; content: string }>;
}

interface SiteDescriptionResponse {
  description: SiteDescription;
  siteName: string;
  siteNameTranslations: Record<string, string>;
}

export default function SiteDescriptionEditor() {
  const { t, i18n } = useTranslation();
  const [currentLocale, setCurrentLocale] = useState(() => (i18n.language || 'en').split('-')[0]);
  const [description, setDescription] = useState<SiteDescription>({
    title: '',
    content: '',
    translations: {},
  });
  const [siteName, setSiteName] = useState('');
  const [siteNameTranslations, setSiteNameTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDescription();
  }, []);

  useEffect(() => {
    const locale = (i18n.language || 'en').split('-')[0];
    setCurrentLocale(locale);
  }, [i18n.language]);

  const loadDescription = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch<SiteDescriptionResponse>('/api/admin/site-description');
      setDescription(data.description || { title: '', content: '', translations: {} });
      setSiteName(data.siteName || '');
      setSiteNameTranslations(data.siteNameTranslations || {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSaved(false);
      const payload: SiteDescription = {
        ...description,
        title: siteName || description.title || '',
      };

      await apiFetch('/api/admin/site-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: payload }),
      });

      setDescription(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const getCurrentTitle = () => {
    if (currentLocale === 'en') {
      return siteName || description.title || '';
    }

    return (
      siteNameTranslations[currentLocale] ||
      description.translations[currentLocale]?.title ||
      siteName ||
      description.title ||
      ''
    );
  };

  const getCurrentContent = () => {
    const localized = description.translations[currentLocale]?.content;
    if (localized && localized.trim().length > 0) {
      return localized;
    }
    return description.content || '';
  };

  const updateCurrentTranslation = (field: 'title' | 'content', value: string) => {
    setDescription((prev) => {
      const updated = { ...prev };

      if (currentLocale === 'en' || !updated.translations.en) {
        // Update default
        updated[field] = value;
      }

      // Update translation
      if (!updated.translations[currentLocale]) {
        updated.translations[currentLocale] = { title: '', content: '' };
      }
      updated.translations[currentLocale][field] = value;

      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('editSiteDescription') || 'Edit Site Description'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-sage-700 mb-2">
              {t('title') || 'Title'}
            </label>
            <input
              id="title"
              type="text"
              value={getCurrentTitle()}
              onChange={(e) => updateCurrentTranslation('title', e.target.value)}
              className="w-full px-3 py-2 border border-sage-200 rounded-md focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              placeholder={t('enterTitle') || 'Enter title'}
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-sage-700 mb-2">
              {t('content') || 'Content'}
            </label>
            <EditorRich
              value={getCurrentContent()}
              locale={currentLocale}
              onChange={(content) => updateCurrentTranslation('content', content)}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saved && <Check className="w-4 h-4" />}
              {!saving && !saved && <Save className="w-4 h-4" />}
              {saved ? (t('saved') || 'Saved!') : (t('save') || 'Save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
