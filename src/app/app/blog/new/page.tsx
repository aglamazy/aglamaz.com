"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import EditorRich from '@/components/ui/EditorRich';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import BlogSetupModal from '@/components/blog/BlogSetupModal';

export default function NewPostPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const memberLoading = useMemberStore((state) => state.loading);
  const site = useSiteStore((state) => state.siteInfo);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [requestedMember, setRequestedMember] = useState(false);
  const [error, setError] = useState('');
  const [mdSource, setMdSource] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importMarkdown = useCallback((md: string) => {
    setImportError('');
    try {
      const rawHtml = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
      const safeHtml = DOMPurify.sanitize(rawHtml);

      // If no title yet, lift the first H1 out of the md as the title.
      if (!title.trim()) {
        const h1 = md.match(/^\s*#\s+(.+?)\s*$/m);
        if (h1?.[1]) setTitle(h1[1].trim());
      }

      setContent(safeHtml);
    } catch (err) {
      console.error('[blog-new] markdown import failed', err);
      setImportError(
        t('failedToImportMarkdown', { defaultValue: 'Failed to import markdown' }) as string
      );
    }
  }, [t, title]);

  const handleMdFile = useCallback(async (file: File) => {
    const text = await file.text();
    setMdSource(text);
    importMarkdown(text);
  }, [importMarkdown]);

  useEffect(() => {
    if (!requestedMember && user?.user_id && site?.id) {
      setRequestedMember(true);
      fetchMember(user.user_id, site.id);
    }
  }, [fetchMember, requestedMember, site?.id, user?.user_id]);

  useEffect(() => {
    if (!memberLoading && member && !member.blogEnabled) {
      setShowSetup(true);
    }
  }, [member, memberLoading]);

  useEffect(() => {
    if (requestedMember && !memberLoading && !member) {
      router.replace('/app/blog');
    }
  }, [member, memberLoading, requestedMember, router]);

  const handleSetupSuccess = useCallback(async () => {
    if (user?.user_id && site?.id) {
      await fetchMember(user.user_id, site.id);
    }
    setShowSetup(false);
  }, [fetchMember, site?.id, user?.user_id]);

  const handleSetupClose = useCallback(() => {
    if (!member?.blogEnabled) {
      router.replace('/app/blog');
    }
    setShowSetup(false);
  }, [member?.blogEnabled, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id || !site?.id) {
      setError(t('failedToSaveBlogPost', { defaultValue: 'Failed to save blog post' }) as string);
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError(t('pleaseFillAllFields', { defaultValue: 'Please fill all fields' }) as string);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiFetch(ApiRoute.SITE_BLOG, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { authorId: user.user_id, title, content, isPublic, lang: i18n.language }
      });
      router.push('/app/blog');
    } catch (error) {
      console.error('[blog-new] failed to save post', error);
      setError(t('failedToSaveBlogPost', { defaultValue: 'Failed to save blog post' }) as string);
    } finally {
      setSaving(false);
    }
  };

  const disableActions = saving || memberLoading || showSetup;

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{t('newPost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <div className="text-red-600 text-sm">{error}</div> : null}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border p-2"
              placeholder={t('title') as string}
              disabled={disableActions}
            />
            <details className="rounded border border-sage-200 p-3">
              <summary className="cursor-pointer text-sm text-sage-700">
                {t('importFromMarkdown', { defaultValue: 'Import from markdown (.md)' }) as string}
              </summary>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    className="text-sm"
                    disabled={disableActions}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMdFile(file);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                </div>
                <textarea
                  value={mdSource}
                  onChange={(e) => setMdSource(e.target.value)}
                  className="w-full border p-2 text-sm font-mono min-h-[120px]"
                  placeholder={t('orPasteMarkdownHere', { defaultValue: 'or paste markdown here…' }) as string}
                  disabled={disableActions}
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => importMarkdown(mdSource)}
                    disabled={disableActions || !mdSource.trim()}
                  >
                    {t('importIntoEditor', { defaultValue: 'Import into editor' }) as string}
                  </Button>
                  {importError ? <span className="text-red-600 text-sm">{importError}</span> : null}
                </div>
              </div>
            </details>
            <div className={disableActions ? 'pointer-events-none opacity-60' : ''}>
              <EditorRich
                value={content}
                locale={(i18n.language || 'en').split('-')[0]}
                onChange={setContent}
              />
            </div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                disabled={disableActions}
              />
              <span>{t('public')}</span>
            </label>
            <Button type="submit" disabled={disableActions}>
              {saving ? t('saving') : t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <BlogSetupModal open={showSetup} onClose={handleSetupClose} onSuccess={handleSetupSuccess} />
    </>
  );
}
