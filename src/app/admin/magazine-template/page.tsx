"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { Loader2, Save, Check, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';

interface MagazineTemplate {
  siteId: string;
  html: string;
  updatedAt: any;
  source: 'manual' | 'ai-suggested';
}

interface MagazineTemplateResponse {
  template: MagazineTemplate | null;
}

export default function MagazineTemplateEditor() {
  const { t } = useTranslation();
  const site = useSiteStore(state => state.siteInfo);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (site?.id) {
      loadTemplate();
    }
  }, [site?.id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch<MagazineTemplateResponse>(ApiRoute.SITE_MAGAZINE_TEMPLATE);
      setHtml(data.template?.html || '');
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
      await apiFetch(ApiRoute.SITE_MAGAZINE_TEMPLATE, {
        method: 'POST',
        body: { html },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSuggest = async () => {
    try {
      setSuggesting(true);
      setError('');
      const data = await apiFetch<{ html: string }>(ApiRoute.SITE_MAGAZINE_TEMPLATE_SUGGEST, {
        method: 'POST',
      });
      setHtml(data.html);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
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
            <span>{t('editMagazineTemplate') || 'Edit Monthly Magazine Template'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <p className="text-sm text-sage-600">
            {t('magazineTemplateDescription') ||
              'This HTML template controls how the monthly family magazine digest looks. Use the AI suggester for a starting draft, then edit as needed.'}
          </p>

          <div>
            <label htmlFor="magazine-html" className="block text-sm font-medium text-sage-700 mb-2">
              {t('magazineTemplateHtml') || 'Template HTML'}
            </label>
            <textarea
              id="magazine-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={20}
              spellCheck={false}
              className="w-full font-mono text-sm border border-sage-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-400"
              placeholder={t('magazineTemplatePlaceholder') || '<html>...</html>'}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSuggest}
              disabled={suggesting}
              variant="outline"
              className="flex items-center gap-2"
            >
              {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('suggestTemplate') || 'Suggest a Starting Template'}
            </Button>
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
