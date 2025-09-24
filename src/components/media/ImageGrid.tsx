"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ImageGrid.module.css';
import { useTranslation } from 'react-i18next';

export interface GridItem {
  key: string;
  src: string;
  title?: string;
}

export interface LikeMeta { count: number; likedByMe: boolean; }

interface ImageGridProps {
  items: GridItem[];
  getMeta: (item: GridItem) => LikeMeta;
  onToggle: (item: GridItem) => Promise<void> | void;
}

export default function ImageGrid({ items, getMeta, onToggle }: ImageGridProps) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGestureHint, setShowGestureHint] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const hideGestureHint = useCallback(() => {
    setShowGestureHint(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowGestureHint(false);
      return;
    }
    if (items.length === 0) return;
    try {
      const key = 'image-grid-gesture-hint';
      const storage = window.localStorage;
      if (!storage.getItem(key)) {
        setShowGestureHint(true);
        storage.setItem(key, '1');
      }
    } catch (err) {
      console.warn('[image-grid] hint storage unavailable', err);
    }
  }, [isMobile, items.length]);

  useEffect(() => {
    setCurrentIndex((prev) => {
      if (items.length === 0) return 0;
      if (prev >= items.length) return items.length - 1;
      if (prev < 0) return 0;
      return prev;
    });
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0) {
      setShowGestureHint(false);
    }
  }, [items.length]);

  useEffect(() => {
    if (isMobile) {
      setLightboxOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      touchStartRef.current = null;
    }
  }, [isMobile]);

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

  const currentItem = items[currentIndex];
  const currentMeta = currentItem ? getMeta(currentItem) : undefined;

  const goNext = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goPrev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const handleMobileToggle = useCallback(() => {
    if (!currentItem) return;
    void onToggle(currentItem);
  }, [currentItem, onToggle]);

  const handleMobileClick = useCallback(() => {
    if (!isMobile) return;
    handleMobileToggle();
    hideGestureHint();
  }, [handleMobileToggle, hideGestureHint, isMobile]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isMobile]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || !touchStartRef.current || items.length === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const threshold = 30;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    let handled = false;

    if (absX > threshold || absY > threshold) {
      if (items.length > 1) {
        if (dx > threshold || dy < -threshold) {
          goNext();
          handled = true;
        } else if (dx < -threshold || dy > threshold) {
          goPrev();
          handled = true;
        }
      }
    } else if (currentItem) {
      if (e.cancelable) e.preventDefault();
      handleMobileToggle();
      handled = true;
    }

    if (handled) hideGestureHint();
    touchStartRef.current = null;
  }, [currentItem, goNext, goPrev, handleMobileToggle, hideGestureHint, isMobile, items.length]);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  if (isMobile) {
    return (
      <div className={styles.mobileViewer}>
        {currentItem && (
          <>
            <div
              className={styles.mobileImageWrap}
              onClick={handleMobileClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
            >
              <img src={currentItem.src} alt="" className={styles.mobileImage} />
              {currentItem.title && (
                <div className={styles.mobileTitle} title={currentItem.title}>{currentItem.title}</div>
              )}
              {currentMeta && (
                <div
                  className={
                    styles.mobileLikeBadge +
                    (showGestureHint ? ' ' + styles.mobileLikeBadgeRaised : '') +
                    (currentMeta.likedByMe ? ' ' + styles.mobileLikeBadgeLiked : '')
                  }
                >
                  <span>❤</span>
                  <span>{currentMeta.count}</span>
                </div>
              )}
            </div>
            {showGestureHint && (
              <div className={styles.mobileHint}>
                <p>{t('photoFeedTapHint')}</p>
                <p>{t('photoFeedSwipeHint')}</p>
                <button type="button" onClick={hideGestureHint}>{t('close')}</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

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
              {it.title && (
                <div className={styles.titleBadge} title={it.title}>{it.title}</div>
              )}
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
