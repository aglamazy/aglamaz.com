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
import { ApiRoute } from '@/entities/Routes';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<LocalizedBlogPost[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [requestingReviewId, setRequestingReviewId] = useState<string | null>(null);

  // Register add action - navigate to new blog post
  useAddAction(() => router.push('/app/blog/new'));

  const isAdmin = member?.role === 'admin';
  const canEditPost = (post: LocalizedBlogPost) => isAdmin || post.post.authorId === user?.user_id;

  useEffect(() => {
    if (!siteInfo?.id) return;

    const fetchPosts = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all blog posts in the site (no authorId filter)
        const data = await apiFetch<{ posts: LocalizedBlogPost[] }>(ApiRoute.SITE_BLOG, {
          queryParams: { lang: i18n.language },
        });
        setPosts(data.posts || []);
      } catch (e) {
        console.error(e);
        setError('failedToLoadBlogPosts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [i18n.language, siteInfo?.id]);

  // Drafts waiting for review (Agla/Shofar 2026-07-27): admin-only - the individual
  // per-draft email link is the only other way to reach these, and it expires in 24h,
  // so a slow review week means posts pile up with no other way to find them again.
  useEffect(() => {
    if (!siteInfo?.id || !isAdmin) return;
    apiFetch<{ posts: LocalizedBlogPost[] }>(ApiRoute.SITE_BLOG, {
      queryParams: { lang: i18n.language, status: 'in_review' },
    })
      .then((data) => setPendingPosts(data.posts || []))
      .catch((e) => console.error('Failed to load pending review posts', e));
  }, [i18n.language, siteInfo?.id, isAdmin]);

  const handleReview = async (postId: string) => {
    if (!siteInfo?.id) return;
    setRequestingReviewId(postId);
    try {
      // Regenerate the token rather than relying on whatever's on the post already - the
      // one from the original email may have expired (24h TTL) by the time an admin
      // catches up via this list, which is exactly the slow-review scenario this exists for.
      const { reviewUrl } = await apiFetch<{ token: string; reviewUrl: string }>(ApiRoute.SITE_BLOG_REQUEST_REVIEW, {
        method: 'POST',
        pathParams: { postId },
      });
      window.location.href = reviewUrl;
    } catch (e) {
      console.error('Failed to request review', e);
    } finally {
      setRequestingReviewId(null);
    }
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  const headerTitle = useMemo(() => {
    if (!hydrated) return '';
    return siteInfo?.name;
  }, [hydrated, siteInfo, t]);

  const loadError = error ? (t('failedToLoadBlogPosts', { defaultValue: 'Failed to load blog posts' }) as string) : '';

  return (
    <div className={styles.container}>
      <div className="hidden md:block">
        <AddFab ariaLabel={t('add') as string} onClick={() => router.push('/app/blog/new')}/>
      </div>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>{headerTitle}</h1>
      </header>
      {isAdmin && pendingPosts.length > 0 && (
        <div className={styles.list} style={{ marginBottom: '1rem' }}>
          <Button
            variant={showPending ? 'primary' : 'outline'}
            onClick={() => setShowPending((prev) => !prev)}
          >
            {t('draftsWaitingForReview', { defaultValue: 'Drafts waiting for review' })} ({pendingPosts.length})
          </Button>
          {showPending && (
            <div className={styles.list} style={{ marginTop: '0.75rem' }}>
              {pendingPosts.map((entry) => (
                <Card
                  key={entry.post.id}
                  className={`${styles.card} rounded-none md:rounded-2xl overflow-hidden shadow-lg md:shadow-md border-none md:border-b mx-4 my-2 md:mx-0 md:my-0`}
                >
                  <CardHeader className={`${styles.cardHeader} p-4 md:p-3 md:bg-transparent`}>
                    <CardTitle className={styles.cardTitle}>{entry.localized.title}</CardTitle>
                  </CardHeader>
                  <CardContent className={`${styles.cardContent} p-0 md:p-3 md:pb-4`}>
                    <div className={styles.cardActions}>
                      <Button
                        className={styles.editButton}
                        disabled={requestingReviewId === entry.post.id}
                        onClick={() => handleReview(entry.post.id)}
                      >
                        {requestingReviewId === entry.post.id
                          ? (t('loading') as string)
                          : (t('review', { defaultValue: 'Review' }) as string)}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
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
        <div className={styles.emptyState}>
          {t('noPostsYetCreateFirst', { defaultValue: "No posts yet, let's create the first." })}
        </div>
      ) : null}
    </div>
  );
}
