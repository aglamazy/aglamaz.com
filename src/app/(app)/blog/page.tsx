'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DOMPurify from 'dompurify';
import AddFab from '@/components/ui/AddFab';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';

export default function BlogPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const [posts, setPosts] = useState<IBlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user?.user_id) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<{ posts: IBlogPost[] }>(`/api/blog?authorId=${user.user_id}&lang=${i18n.language}`);
        setPosts(data.posts || []);
      } catch (e) {
        console.error(e);
        setError('Failed to load posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [user?.user_id, i18n.language]);

  return (
    <div className="space-y-4">
      <AddFab ariaLabel={t('add') as string} onClick={() => router.push('/blog/new')} />
      {loading && <div className="text-gray-500">{t('loading') as string}</div>}
      {error && <div className="text-red-600">{error}</div>}
      {posts.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <CardTitle>{post.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
            />
            <Link href={`/blog/${post.id}/edit`}>
              <Button className="mt-2">{t('edit')}</Button>
            </Link>
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && (
        <div className="text-center text-gray-500">{t('noPostsYet')}</div>
      )}
    </div>
  );
}
