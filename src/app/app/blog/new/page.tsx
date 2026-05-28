"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { BlogPostContentFormat } from '@/entities/BlogPost';

// Default new posts to markdown. Authors can switch to the legacy HTML/TinyMCE
// editor via the toggle. Toggling does NOT auto-convert content — that would be
// a lossy round-trip — so the editor only re-runs the conversion when the
// author asks (the "Import from markdown" block, shown only in HTML mode).
export default function NewPostPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const memberLoading = useMemberStore((state) => state.loading);
  const site = useSiteStore((state) => state.siteInfo);
  const [title, setTitle] = useState('');
  const [contentFormat, setContentFormat] = useState<BlogPostContentFormat>('md');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [requestedMember, setRequestedMember] = useState(false);
  const [error, setError] = useState('');
  const [mdSource, setMdSource] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Used by the (HTML-mode) "Import from markdown" affordance — converts md to
  // sanitized HTML and drops the result into the TinyMCE editor.
  const importMarkdownToHtml = useCallback((md: string) => {
    setImportError('');
    try {
      const rawHtml = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
      const safeHtml = DOMPurify.sanitize(rawHtml);
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
    if (contentFormat === 'md') {
      // In md mode the file content IS the post — drop it straight into the editor.
      if (!title.trim()) {
        const h1 = text.match(/^\s*#\s+(.+?)\s*$/m);
        if (h1?.[1]) setTitle(h1[1].trim());
      }
      setContent(text);
    } else {
      setMdSource(text);
      importMarkdownToHtml(text);
    }
  }, [contentFormat, importMarkdownToHtml, title]);

  // Live HTML preview for md mode. Same marked + DOMPurify pipeline that the
  // read sites use (see BlogPostBody), so authors see what readers will see.
  const mdPreviewHtml = useMemo(() => {
    if (contentFormat !== 'md') return '';
    try {
      const raw = marked.parse(content || '', { async: false, gfm: true, breaks: false }) as string;
      return DOMPurify.sanitize(raw);
    } catch {
      return '';
    }
  }, [content, contentFormat]);

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
        body: { authorId: user.user_id, title, content, isPublic, lang: i18n.language, contentFormat }
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
      <Card className="max-w-3xl mx-auto">
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
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="contentFormat"
                  value="md"
                  checked={contentFormat === 'md'}
                  onChange={() => setContentFormat('md')}
                  disabled={disableActions}
                />
                <span>{t('formatMarkdown', { defaultValue: 'Markdown' }) as string}</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="contentFormat"
                  value="html"
                  checked={contentFormat === 'html'}
                  onChange={() => setContentFormat('html')}
                  disabled={disableActions}
                />
                <span>{t('formatRichHtml', { defaultValue: 'Rich (HTML)' }) as string}</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                className="text-sm ml-auto"
                disabled={disableActions}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMdFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            </div>

            {contentFormat === 'md' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full border p-2 text-sm font-mono min-h-[400px]"
                  placeholder={t('writeMarkdownHere', { defaultValue: 'Write markdown here…' }) as string}
                  disabled={disableActions}
                />
                <div
                  className="prose max-w-none border p-3 min-h-[400px] overflow-auto text-sm"
                  dangerouslySetInnerHTML={{ __html: mdPreviewHtml }}
                />
              </div>
            ) : (
              <>
                <details className="rounded border border-sage-200 p-3">
                  <summary className="cursor-pointer text-sm text-sage-700">
                    {t('importFromMarkdown', { defaultValue: 'Import from markdown (.md)' }) as string}
                  </summary>
                  <div className="mt-3 space-y-2">
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
                        onClick={() => importMarkdownToHtml(mdSource)}
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
              </>
            )}
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
