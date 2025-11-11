"use client";

import React from 'react';
import type { LikerInfo } from '@/types/likes';
import styles from './AvatarStack.module.css';

interface AvatarStackProps {
  likers: LikerInfo[];
  maxVisible?: number;
  size?: number;
  direction?: 'ltr' | 'rtl';
}

function getInitials(name?: string, email?: string) {
  const source = name?.trim() || email?.trim();
  if (!source) {
    throw new Error('[AvatarStack] Missing display name/email for liker');
  }
  const parts = source.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return source.slice(0, 2).toUpperCase();
  }
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function AvatarStack({
  likers,
  maxVisible = 3,
  size = 28,
  direction = 'ltr',
}: AvatarStackProps) {
  const visible = likers.slice(0, maxVisible);
  const remaining = Math.max(0, likers.length - maxVisible);

  return (
    <div
      className={`${styles.stack} ${direction === 'rtl' ? styles.stackRtl : ''}`}
      style={{ ['--avatar-size' as string]: `${size}px` }}
    >
      {visible.map((liker, index) => (
        <div
          key={`${liker.uid}-${index}`}
          className={styles.avatar}
          style={{ zIndex: visible.length - index }}
        >
          {liker.avatarUrl ? (
            <img src={liker.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(liker.displayName, liker.email)}</span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className={`${styles.avatar} ${styles.moreBadge}`} aria-label={`+${remaining}`}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
