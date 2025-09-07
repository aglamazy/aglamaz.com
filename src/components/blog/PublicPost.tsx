'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IBlogPost } from '@/entities/BlogPost';
import { Button } from '@/components/ui/button';
import styles from './PublicPost.module.css';

interface Props {
  post: IBlogPost;
}

export default function PublicPost({ post }: Props) {
  const { t } = useTranslation();
  const [likes, setLikes] = useState(post.likeCount ?? 0);
  const [shares, setShares] = useState(post.shareCount ?? 0);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    setLiking(true);
    try {
      const res = await fetch(`/api/blog/${post.id}/like`, { method: 'POST' });
      const data = await res.json();
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
      await fetch(`/api/blog/${post.id}/share`, { method: 'POST' });
      setShares((s) => s + 1);
      return true;
    } catch (error) {
      console.error('Failed to share post:', error);
      return false;
    }
  };

  return (
    <article className={`prose max-w-none mx-auto py-8 ${styles.article}`}>
      <h1 className="mb-4">{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
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
