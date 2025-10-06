'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useSiteStore } from '@/store/SiteStore';
import { getLocalizedSiteName } from '@/utils/siteName';
import styles from './BlogPage.module.css';

export default function BlogPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const siteInfo = useSiteStore((state) => state.siteInfo);
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
        setError('failedToLoadBlogPosts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [user?.user_id, i18n.language]);

  const localizedSiteName = getLocalizedSiteName(siteInfo, i18n.language);

  const headerTitle = useMemo(() => {
    const siteName = (localizedSiteName || siteInfo?.name || '').trim();
    if (siteName) {
      return t('familyBlogHeader', { site: siteName, defaultValue: '{{site}} Family Blog' }) as string;
    }
    return t('familyBlog') as string;
  }, [localizedSiteName, siteInfo?.name, t]);

  const loadError = error ? (t('failedToLoadBlogPosts', { defaultValue: 'Failed to load blog posts' }) as string) : '';

  return (
    <div className={styles.container}>
      <AddFab ariaLabel={t('add') as string} onClick={() => router.push('/blog/new')} />
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>{headerTitle}</h1>
      </header>
      {loading ? <div className={styles.status}>{t('loading') as string}</div> : null}
      {error ? <div className={`${styles.status} ${styles.statusError}`}>{loadError}</div> : null}
      <div className={styles.list}>
        {posts.map((post, index) => {
          const tintPalette = [styles.tintBlue, styles.tintGreen, styles.tintYellow, styles.tintPurple, styles.tintRose];
          const tintClass = tintPalette[index % tintPalette.length];
          return (
            <Card key={post.id} className={styles.card}>
            <CardHeader className={styles.cardHeader}>
              <CardTitle className={styles.cardTitle}>{post.title}</CardTitle>
            </CardHeader>
            <CardContent className={styles.cardContent}>
              <div
                className={`${styles.cardTint} ${tintClass} prose max-w-none`}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
              />
              <div className={styles.cardActions}>
                <Link href={`/blog/${post.id}/edit`}>
                  <Button className={styles.editButton}>{t('edit')}</Button>
                </Link>
              </div>
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
