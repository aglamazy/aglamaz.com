'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';

export default function BlogPage() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const [posts, setPosts] = useState<IBlogPost[]>([]);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user?.user_id) return;
      try {
        const data = await apiFetch<IBlogPost[]>(`/api/blog?authorId=${user.user_id}`);
        setPosts(data);
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
    fetchPosts();
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/blog/new">
          <Button>{t('newPost')}</Button>
        </Link>
      </div>
      {posts.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <CardTitle>{post.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{post.content}</p>
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

