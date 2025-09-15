"use client";

import React, { useEffect, useState } from 'react';
import styles from './ImageGrid.module.css';
import { useTranslation } from 'react-i18next';

export interface GridItem {
  key: string;
  src: string;
}

export interface LikeMeta { count: number; likedByMe: boolean; }

interface ImageGridProps {
  items: GridItem[];
  getMeta: (item: GridItem) => LikeMeta;
  onToggle: (item: GridItem) => Promise<void> | void;
}

export default function ImageGrid({ items, getMeta, onToggle }: ImageGridProps) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!lightboxOpen || items.length === 0) return;
      if (e.key === 'Escape') { e.preventDefault(); setLightboxOpen(false); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setLightboxIndex((p) => (p - 1 + items.length) % items.length); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setLightboxIndex((p) => (p + 1) % items.length); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, items.length]);

  return (
    <>
      <div className={styles.imagesGrid}>
        {items.map((it, i) => {
          const meta = getMeta(it);
          return (
            <div key={it.key} className={styles.thumbWrap}>
              <img
                src={it.src}
                alt=""
                className={styles.thumb}
                onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              />
              <button
                type="button"
                aria-label={meta.likedByMe ? (t('unlike') as string) : (t('like') as string)}
                className={styles.likeBtn + (meta.likedByMe ? (' ' + styles.likeBtnLiked) : '')}
                onClick={(e) => { e.stopPropagation(); onToggle(it); }}
              >
                <span>❤</span>
                <span>{meta.count}</span>
              </button>
            </div>
          );
        })}
      </div>

      {lightboxOpen && items.length > 0 && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightboxOpen(false)}>
          <button className={styles.navBtn + ' ' + styles.navLeft} onClick={(e) => { e.stopPropagation(); setLightboxIndex((p) => (p - 1 + items.length) % items.length); }}>‹</button>
          <img src={items[lightboxIndex].src} alt="" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
          <button className={styles.navBtn + ' ' + styles.navRight} onClick={(e) => { e.stopPropagation(); setLightboxIndex((p) => (p + 1) % items.length); }}>›</button>
        </div>
      )}
    </>
  );
}

