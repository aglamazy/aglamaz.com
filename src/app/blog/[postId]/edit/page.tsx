'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import type { IBlogPost } from '@/entities/BlogPost';

export default function EditPostPage() {
  const { t } = useTranslation();
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<IBlogPost | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<IBlogPost>(`/api/blog/${params.postId}`);
        setPost(data);
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
    load();
  }, [params.postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    setSaving(true);
    try {
      await apiFetch(`/api/blog/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: post.title, content: post.content, isPublic: post.isPublic })
      });
      router.push('/blog');
    } catch (error) {
      console.error(error);
      throw error;
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
            <textarea
              value={post.content}
              onChange={e => setPost({ ...post, content: e.target.value })}
              className="w-full border p-2 h-48"
              placeholder={t('content') as string}
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

