'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import EditorRich from '@/components/EditorRich';
import type { IBlogPost } from '@/entities/BlogPost';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';

export default function EditPostPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const member = useMemberStore((state) => state.member);

  const [post, setPost] = useState<IBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{ post: IBlogPost }>(`/api/blog?id=${params.postId}&lang=${i18n.language}`);
        setPost(data.post);
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
      await apiFetch(`/api/blog`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          title: post.title,
          content: post.content,
          isPublic: post.isPublic,
          lang: i18n.language,
        }),
      });
      router.push('/app/blog');
    } catch (err) {
      console.error('[blog-edit] failed to save post', err);
      setError(t('failedToLoadBlogPosts') as string);
    } finally {
      setSaving(false);
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
            value={post.title}
            onChange={(event) => setPost({ ...post, title: event.target.value })}
            className="w-full border border-sage-200 rounded-md px-3 py-2"
            placeholder={t('title') as string}
          />
          <EditorRich value={post.content} onChange={(html) => setPost({ ...post, content: html })} />
          <label className="flex items-center gap-2 text-sage-700">
            <input
              type="checkbox"
              checked={post.isPublic}
              onChange={(event) => setPost({ ...post, isPublic: event.target.checked })}
            />
            <span>{t('public')}</span>
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? (t('saving') as string) : (t('save') as string)}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
