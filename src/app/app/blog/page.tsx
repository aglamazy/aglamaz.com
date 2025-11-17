'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DOMPurify from 'dompurify';
import AddFab from '@/components/ui/AddFab';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LocalizedBlogPost } from '@/entities/BlogPost';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useSiteStore } from '@/store/SiteStore';
import { useMemberStore } from '@/store/MemberStore';
import styles from './BlogPage.module.css';
import { useAddAction } from '@/hooks/useAddAction';

export default function BlogPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const [posts, setPosts] = useState<LocalizedBlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register add action - navigate to new blog post
  useAddAction(() => router.push('/app/blog/new'));

  const isAdmin = member?.role === 'admin';
  const canEditPost = (post: LocalizedBlogPost) => isAdmin || post.post.authorId === user?.user_id;

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all blog posts in the site (no authorId filter)
        const data = await apiFetch<{ posts: LocalizedBlogPost[] }>(`/api/blog?lang=${i18n.language}`);
        setPosts(data.posts || []);
      } catch (e) {
        console.error(e);
        setError('failedToLoadBlogPosts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [i18n.language]);

  const headerTitle = useMemo(() => {
    return siteInfo?.name;
  }, [siteInfo, t]);

  const loadError = error ? (t('failedToLoadBlogPosts', { defaultValue: 'Failed to load blog posts' }) as string) : '';

  return (
    <div className={styles.container}>
      <div className="hidden md:block">
        <AddFab ariaLabel={t('add') as string} onClick={() => router.push('/app/blog/new')}/>
      </div>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>{headerTitle}</h1>
      </header>
      {loading ? <div className={styles.status}>{t('loading') as string}</div> : null}
      {error ? <div className={`${styles.status} ${styles.statusError}`}>{loadError}</div> : null}
      <div className={styles.list}>
        {posts.map((entry, index) => {
          const { post, localized } = entry;
          const tintPalette = [styles.tintBlue, styles.tintGreen, styles.tintYellow, styles.tintPurple, styles.tintRose];
          const tintClass = tintPalette[index % tintPalette.length];
          return (
            <Card key={post.id} className={`${styles.card} rounded-none md:rounded-2xl overflow-hidden shadow-lg md:shadow-md border-none md:border-b mx-4 my-2 md:mx-0 md:my-0`}>
              <CardHeader className={`${styles.cardHeader} p-4 md:p-3 md:bg-transparent`}>
                <CardTitle className={styles.cardTitle}>{localized.title}</CardTitle>
              </CardHeader>
              <CardContent className={`${styles.cardContent} p-0 md:p-3 md:pb-4`}>
                <div className={`${styles.cardTint} ${tintClass} p-4 md:p-3`}>
                  <div
                    className="prose prose-slate dark:prose-invert"
                    style={{ maxWidth: '100%', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(localized.content || '') }}
                  />
                </div>
                {canEditPost(entry) && (
                  <div className={styles.cardActions}>
                    <Link href={`/app/blog/${post.id}/edit`}>
                      <Button className={styles.editButton}>{t('edit')}</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {posts.length === 0 && !loading && !error ? (
        <div className={styles.emptyState}>{t('noPostsYet')}</div>
      ) : null}
    </div>
  );
}
