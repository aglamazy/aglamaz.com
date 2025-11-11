"use client";

import React, { useEffect, useRef } from 'react';
import type { LikerInfo } from '@/types/likes';
import styles from './LikersPopover.module.css';
import { formatRelativeTime } from '@/utils/dateFormat';

interface LikersPopoverProps {
  likers: LikerInfo[];
  onClose: () => void;
  onNavigateProfile?: (liker: LikerInfo) => void;
  title: string;
  emptyLabel: string;
  dir: 'ltr' | 'rtl';
  language: string;
  anchorEl: HTMLElement | null;
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

export default function LikersPopover({
  likers,
  onClose,
  onNavigateProfile,
  title,
  emptyLabel,
  dir,
  language,
  anchorEl,
}: LikersPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, anchorEl]);

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom + 8,
    left: rect.left,
    zIndex: 1000,
  };

  return (
    <div
      ref={popoverRef}
      className={`${styles.popover} ${dir === 'rtl' ? styles.popoverRtl : ''}`}
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.header}>
        <h3>{title}</h3>
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
  );
}
