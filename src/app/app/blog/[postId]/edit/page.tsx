'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import EditorRich from '@/components/ui/EditorRich';
import type { IBlogPost, BlogPostLocalizedFields } from '@/entities/BlogPost';
import { localizeBlogPost } from '@/utils/blogLocales';
import { DEFAULT_LOCALE } from '@/i18n';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';

export default function EditPostPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const member = useMemberStore((state) => state.member);

  const [post, setPost] = useState<IBlogPost | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftPublic, setDraftPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setDraftPublic(data.post?.isPublic ?? false);
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
          />
          <EditorRich
            value={draftContent}
            locale={(i18n.language || 'en').split('-')[0]}
            onChange={(html) => setDraftContent(html)}
          />
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
            <Button type="submit" disabled={saving || deleting}>
              {saving ? (t('saving') as string) : (t('save') as string)}
            </Button>
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
