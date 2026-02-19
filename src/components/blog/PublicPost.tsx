'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IBlogPost, BlogPostLocalizedFields } from '@/entities/BlogPost';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { formatLocalizedDate } from '@/utils/dateFormat';
import { resolveDateLocale } from '@/utils/timezoneRegion';
import styles from './PublicPost.module.css';

interface Props {
  post: IBlogPost;
  localized: BlogPostLocalizedFields;
}

export default function PublicPost({ post, localized }: Props) {
  const { t, i18n } = useTranslation();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateLocale = resolveDateLocale(i18n.language, tz);
  const [likes, setLikes] = useState(post.likeCount ?? 0);
  const [shares, setShares] = useState(post.shareCount ?? 0);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    setLiking(true);
    try {
      const data = await apiFetch<{ likeCount?: number }>(ApiRoute.SITE_BLOG_LIKE, {
        method: 'POST',
        pathParams: { postId: post.id },
      });
      setLikes(data.likeCount ?? likes + 1);
      return true;
    } catch (error) {
      console.error('Failed to like post:', error);
      return false;
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      await apiFetch(ApiRoute.SITE_BLOG_SHARE, {
        method: 'POST',
        pathParams: { postId: post.id },
      });
      setShares((s) => s + 1);
      return true;
    } catch (error) {
      console.error('Failed to share post:', error);
      return false;
    }
  };

  return (
    <article className={`prose max-w-none mx-auto py-8 ${styles.article}`}>
      <h1 className="mb-1">{localized.title}</h1>
      {post.createdAt && <div className="text-sm text-gray-500 mb-4">{formatLocalizedDate(post.createdAt, dateLocale)}</div>}
      <div dangerouslySetInnerHTML={{ __html: localized.content }} />
      <div className="flex items-center space-x-4 mt-6">
        <Button onClick={handleLike} disabled={liking}>
          {t('like')} ({likes})
        </Button>
        <Button onClick={handleShare}>
          {t('share')} ({shares})
        </Button>
      </div>
    </article>
  );
}
