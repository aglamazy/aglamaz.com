"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { LikerInfo } from '@/types/likes';
import styles from './LikersBottomSheet.module.css';
import { formatRelativeTime } from '@/utils/dateFormat';

interface LikersBottomSheetProps {
  open: boolean;
  likers: LikerInfo[];
  onClose: () => void;
  onNavigateProfile?: (liker: LikerInfo) => void;
  title: string;
  emptyLabel: string;
  dir: 'ltr' | 'rtl';
  language: string;
}

function getInitials(name?: string, email?: string) {
  const source = name || email || '';
  if (!source) return '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return source.slice(0, 2).toUpperCase();
  }
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function LikersBottomSheet({
  open,
  likers,
  onClose,
  onNavigateProfile,
  title,
  emptyLabel,
  dir,
  language,
}: LikersBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    if (!open) {
      setTranslateY(0);
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setTranslateY(0);
    }
  }, [open]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    startY.current = event.touches[0].clientY;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const delta = event.touches[0].clientY - startY.current;
    if (delta > 0) {
      setTranslateY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (translateY > 80) {
      onClose();
    } else {
      setTranslateY(0);
    }
    startY.current = null;
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <button className={styles.backdrop} onClick={onClose} aria-label="Close" />
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${dir === 'rtl' ? styles.sheetRtl : ''}`}
        style={{ transform: `translateY(${translateY}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.dragHandle} />
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={styles.closeButton}>
            ✕
          </button>
        </div>
        <div className={styles.content} dir={dir}>
          {likers.length === 0 ? (
            <div className={styles.empty}>{emptyLabel}</div>
          ) : (
            <ul className={styles.list}>
              {likers.map((liker) => {
                const timeAgo = liker.likedAt ? formatRelativeTime(liker.likedAt, language) : '';
                return (
                  <li key={liker.uid}>
                    <button
                      type="button"
                      className={styles.likerRow}
                      onClick={() => {
                        if (onNavigateProfile) {
                          onNavigateProfile(liker);
                        }
                      }}
                    >
                      {liker.avatarUrl ? (
                        <img src={liker.avatarUrl} alt="" className={styles.likerAvatar} />
                      ) : (
                        <div className={styles.likerAvatar}>
                          <span>{getInitials(liker.displayName, liker.email)}</span>
                        </div>
                      )}
                      <div className={styles.likerInfo}>
                        <span className={styles.likerName}>{liker.displayName}</span>
                        {timeAgo ? <span className={styles.likerTime}>{timeAgo}</span> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
