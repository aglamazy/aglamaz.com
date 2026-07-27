'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import EditorRich from '@/components/ui/EditorRich';
import type { IBlogPost, BlogPostLocalizedFields, BlogPostContentFormat } from '@/entities/BlogPost';
import { localizeBlogPost } from '@/utils/blogLocales';
import { DEFAULT_LOCALE } from '@/i18n';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';

// Edit honors the existing post's contentFormat. Authors can switch formats
// here too, but as in the new-post page, switching does NOT auto-convert the
// content body (would be a lossy round-trip). Existing posts without the field
// load as 'html' (back-compat default in BlogRepository.mapDoc).
export default function EditPostPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const member = useMemberStore((state) => state.member);
  const siteId = useSiteStore((state) => state.siteInfo?.id);

  const [post, setPost] = useState<IBlogPost | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftFormat, setDraftFormat] = useState<BlogPostContentFormat>('html');
  const [draftPublic, setDraftPublic] = useState(false);
  const [draftLocale, setDraftLocale] = useState(DEFAULT_LOCALE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{ post: IBlogPost; localized?: BlogPostLocalizedFields }>(ApiRoute.SITE_BLOG, {
          queryParams: { id: params.postId, lang: i18n.language },
        });
        setPost(data.post);
        const localizedData = data.localized ?? localizeBlogPost(data.post, {
          preferredLocale: i18n.language,
          fallbackLocales: [DEFAULT_LOCALE],
        }).localized;
        setDraftTitle(localizedData.title ?? '');
        setDraftContent(localizedData.content ?? '');
        setDraftFormat(data.post?.contentFormat ?? 'html');
        setDraftPublic(data.post?.isPublic ?? false);
        setDraftLocale(localizedData.locale || DEFAULT_LOCALE);
        setError(null);
      } catch (err) {
        console.error('[blog-edit] failed to load post', err);
        setError(t('failedToLoadBlogPosts') as string);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.postId, i18n.language, t]);

  useEffect(() => {
    if (!post) return;
    const authorId = post.authorId;
    const canEdit = user?.user_id === authorId || member?.role === 'admin';
    if (!canEdit) {
      router.replace('/app/blog');
    }
  }, [post, user?.user_id, member?.role, router]);

  // The post's own authored language, not the admin's current UI language -
  // an admin viewing the site in Hebrew must still be able to edit an
  // English post without its title/body being forced into RTL layout.
  const contentDir = draftLocale.toLowerCase().startsWith('he') ? 'rtl' : 'ltr';

  const mdPreviewHtml = useMemo(() => {
    if (draftFormat !== 'md') return '';
    try {
      const raw = marked.parse(draftContent || '', { async: false, gfm: true, breaks: false }) as string;
      return DOMPurify.sanitize(raw);
    } catch {
      return '';
    }
  }, [draftContent, draftFormat]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!post) return;
    setSaving(true);
    try {
      await apiFetch(ApiRoute.SITE_BLOG, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          title: draftTitle,
          content: draftContent,
          isPublic: draftPublic,
          lang: i18n.language,
          contentFormat: draftFormat,
        }),
      });
      router.push('/app/blog');
    } catch (err) {
      console.error('[blog-edit] failed to save post', err);
      setError(t('failedToSaveBlogPost') as string);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!post) return;
    setSubmittingReview(true);
    setError(null);
    try {
      await apiFetch(ApiRoute.SITE_BLOG_REQUEST_REVIEW, {
        method: 'POST',
        pathParams: { postId: post.id },
      });
      setSubmittedReview(true);
      setPost({ ...post, status: 'in_review' });
    } catch (err) {
      console.error('[blog-edit] failed to submit for review', err);
      setError(t('failedToSubmitForReview', { defaultValue: 'Failed to submit for review' }) as string);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(ApiRoute.SITE_BLOG, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      router.push('/app/blog');
    } catch (err) {
      console.error('[blog-edit] failed to delete post', err);
      setError(t('failedToDeleteBlogPost') as string);
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sage-600">{t('loading') as string}</div>
    );
  }

  if (!post || error) {
    return (
      <div className="p-4 text-center text-red-600">{error || t('failedToLoadBlogPosts')}</div>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{t('editPost')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="w-full border border-sage-200 rounded-md px-3 py-2"
            placeholder={t('title') as string}
            dir={contentDir}
          />
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="contentFormat"
                value="md"
                checked={draftFormat === 'md'}
                onChange={() => setDraftFormat('md')}
              />
              <span>{t('formatMarkdown', { defaultValue: 'Markdown' }) as string}</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="contentFormat"
                value="html"
                checked={draftFormat === 'html'}
                onChange={() => setDraftFormat('html')}
              />
              <span>{t('formatRichHtml', { defaultValue: 'Rich (HTML)' }) as string}</span>
            </label>
          </div>
          {draftFormat === 'md' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full border p-2 text-sm font-mono min-h-[400px]"
                placeholder={t('writeMarkdownHere', { defaultValue: 'Write markdown here…' }) as string}
                dir={contentDir}
              />
              <div
                className="prose max-w-none border p-3 min-h-[400px] overflow-auto text-sm"
                dir={contentDir}
                dangerouslySetInnerHTML={{ __html: mdPreviewHtml }}
              />
            </div>
          ) : (
            <EditorRich
              value={draftContent}
              locale={draftLocale.split('-')[0]}
              onChange={(html) => setDraftContent(html)}
              siteId={siteId}
            />
          )}
          <label className="flex items-center gap-2 text-sage-700">
            <input
              type="checkbox"
              checked={draftPublic}
              onChange={(event) => setDraftPublic(event.target.checked)}
            />
            <span>{t('public')}</span>
          </label>
          <div className="flex gap-3 justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving || deleting}
            >
              {t('delete')}
            </Button>
            <div className="flex gap-3">
              {post.status === 'draft' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSubmitForReview}
                  disabled={saving || deleting || submittingReview || submittedReview}
                >
                  {submittedReview
                    ? (t('submittedForReview', { defaultValue: 'Submitted for review' }) as string)
                    : submittingReview
                      ? (t('loading') as string)
                      : (t('submitForReview', { defaultValue: 'Submit for review' }) as string)}
                </Button>
              )}
              <Button type="submit" disabled={saving || deleting}>
                {saving ? (t('saving') as string) : (t('save') as string)}
              </Button>
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-sage-900 mb-4">
                {t('confirmDeletePost')}
              </h3>
              <p className="text-sm text-sage-700 mb-6">
                {t('confirmDeletePostMessage')}
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('deleting') : t('delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
