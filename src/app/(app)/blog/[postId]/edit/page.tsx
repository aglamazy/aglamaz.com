'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import EditorRich from '@/components/EditorRich';
import type { IBlogPost } from '@/entities/BlogPost';

export default function EditPostPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<IBlogPost | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<{ post: IBlogPost }>(`/api/blog?id=${params.postId}&lang=${i18n.language}`);
        setPost(data.post);
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, [params.postId, i18n.language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    setSaving(true);
    try {
      await apiFetch(`/api/blog`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, title: post.title, content: post.content, isPublic: post.isPublic, lang: i18n.language })
      });
      router.push('/blog');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('editPost')}</CardTitle>
      </CardHeader>
      <CardContent>
        {post ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={post.title}
              onChange={e => setPost({ ...post, title: e.target.value })}
              className="w-full border p-2"
              placeholder={t('title') as string}
            />
            <EditorRich
              value={post.content}
              onChange={(html) => setPost({ ...post, content: html })}
            />
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={post.isPublic}
                onChange={e => setPost({ ...post, isPublic: e.target.checked })}
              />
              <span>{t('public')}</span>
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </form>
        ) : (
          <div>{t('loading')}</div>
        )}
      </CardContent>
    </Card>
  );
}
