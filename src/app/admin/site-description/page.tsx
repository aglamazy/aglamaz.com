"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { Loader2, Save, Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';
import dynamic from 'next/dynamic';

const EditorRich = dynamic(() => import('@/components/ui/EditorRich'), { ssr: false });

interface SiteLocaleContent {
  name?: string;
  name$meta?: { source: string; updatedAt: any };
  aboutFamily?: string;
  aboutFamily$meta?: { source: string; updatedAt: any };
  platformName?: string;
  platformName$meta?: { source: string; updatedAt: any };
}

interface SiteInfo {
  id: string;
  name?: string;
  aboutFamily?: string;
  platformName?: string;
  sourceLang: string; // For backwards compatibility (most recent locale)
  locales: Record<string, SiteLocaleContent>;
}

interface SiteResponse {
  site: SiteInfo;
}

const normalizeLocale = (locale: string) => {
  try {
    return (locale || '').split('-')[0]?.toLowerCase() || '';
  } catch {
    return '';
  }
};

const findLocaleContent = (info: SiteInfo | null, locale: string): SiteLocaleContent | null => {
  if (!info || !info.locales) return null;
  const locales = info.locales;

  const direct = locales[locale];
  if (direct) return direct;

  const lowered = locale.toLowerCase();
  const exactKey = Object.keys(locales).find((key) => key.toLowerCase() === lowered);
  if (exactKey) return locales[exactKey];

  const base = normalizeLocale(locale);
  if (!base) return null;

  const baseEntry = Object.entries(locales).find(([key]) => normalizeLocale(key) === base);
  return baseEntry ? baseEntry[1] : null;
};

export default function SiteDescriptionEditor() {
  const { t, i18n } = useTranslation();
  const site = useSiteStore(state => state.siteInfo);
  const [currentLocale, setCurrentLocale] = useState(() => normalizeLocale(i18n.language || 'en') || 'en');
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
    if (site?.id) {
      loadSiteInfo(currentLocale);
    }
  }, [currentLocale, site?.id]);

  useEffect(() => {
    const locale = normalizeLocale(i18n.language || 'en') || 'en';
    setCurrentLocale(locale);
  }, [i18n.language]);

  const loadSiteInfo = async (locale: string) => {
    if (!locale || !site?.id) return;
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch<SiteResponse>(ApiRoute.SITE_DESCRIPTION, {
        queryParams: { locale: encodeURIComponent(locale) },
      });
      setSiteInfo(data.site);
      updateFormFields(locale, data.site);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormFields = (locale: string, site?: SiteInfo) => {
    const info = site || siteInfo;
    if (!info) return;

    // Use top-level fields from API response (already localized by LocalizationService)
    setName(info.name || '');
    setAboutFamily(info.aboutFamily || '');
    setPlatformName(info.platformName || '');
  };

  const handleSave = async (requestTranslations = false) => {
    if (!siteInfo || !site?.id) return;

    try {
      setSaving(true);
      setError('');
      setSaved(false);

      await apiFetch(ApiRoute.SITE_DESCRIPTION, {
        method: 'POST',
        body: {
          locale: currentLocale,
          name,
          aboutFamily,
          platformName,
          requestTranslations,
        },
      });

      // Reload site info
      await loadSiteInfo(currentLocale);
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('editSiteDescription') || 'Edit Site Information'}</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
