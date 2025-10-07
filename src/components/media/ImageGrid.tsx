"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ImageGrid.module.css';
import { useTranslation } from 'react-i18next';
import { usePresentationModeStore } from '@/store/PresentationModeStore';

export interface GridItem {
  key: string;
  src: string;
  title?: string;
  meta?: Record<string, unknown>;
  dir?: 'ltr' | 'rtl' | 'auto';
}

export interface LikeMeta { count: number; likedByMe: boolean; }

interface ImageGridProps {
  items: GridItem[];
  getMeta: (item: GridItem) => LikeMeta;
  onToggle: (item: GridItem) => Promise<void> | void;
  onTitleClick?: (item: GridItem) => void;
}

export default function ImageGrid({ items, getMeta, onToggle, onTitleClick }: ImageGridProps) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const prefetchedSrc = useRef<Set<string>>(new Set());
  const presentationListRef = useRef<HTMLDivElement | null>(null);

  const enablePresentation = usePresentationModeStore((state) => state.enable);
  const disablePresentation = usePresentationModeStore((state) => state.disable);

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
    if (typeof window === 'undefined' || items.length === 0) return;

    const newSources = items
      .map((item) => item.src)
      .filter((src) => src && !prefetchedSrc.current.has(src));

    newSources.forEach((src) => {
      const img = new Image();
      img.src = src;
      prefetchedSrc.current.add(src);
    });
  }, [items]);

  useEffect(() => {
    if (!isMobile) {
      setShowGestureHint(false);
      setPresentationMode(false);
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
      setPresentationMode(false);
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

  const openPresentationMode = useCallback(() => {
    if (!isMobile || items.length === 0) return;
    setPresentationMode(true);
    hideGestureHint();
  }, [hideGestureHint, isMobile, items.length]);

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
    } else {
      if (e.cancelable) e.preventDefault();
      openPresentationMode();
      handled = true;
    }

    if (handled) hideGestureHint();
    touchStartRef.current = null;
  }, [goNext, goPrev, hideGestureHint, isMobile, items.length, openPresentationMode]);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  useEffect(() => {
    if (!presentationMode) return;
    enablePresentation();

    if (typeof document !== 'undefined') {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = previousOverflow;
        disablePresentation();
      };
    }

    return () => {
      disablePresentation();
    };
  }, [presentationMode, enablePresentation, disablePresentation]);

  useEffect(() => {
    if (!presentationMode) return;
    const container = presentationListRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-presentation-index="${currentIndex}"]`
    );
    if (target) {
      requestAnimationFrame(() => {
        container.scrollTo({ top: target.offsetTop, behavior: 'auto' });
      });
    }
  }, [presentationMode, currentIndex]);

  useEffect(() => {
    if (!presentationMode) return;
    if (items.length === 0) {
      setPresentationMode(false);
    }
  }, [items.length, presentationMode]);

  const handlePresentationClose = useCallback(() => {
    setPresentationMode(false);
  }, []);

  if (isMobile) {
    return (
      <div className={styles.mobileViewer}>
        {presentationMode && (
          <div className={styles.presentationOverlay}>
            <div className={styles.presentationTopBar}>
              <button
                type="button"
                className={styles.presentationBackBtn}
                onClick={handlePresentationClose}
                aria-label={t('photoFeedBack') as string}
              >
                <span className={styles.presentationBackIcon} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.presentationList} ref={presentationListRef}>
              {items.map((item, index) => {
                const meta = getMeta(item);
                const metaInfo = item.meta as { canEdit?: boolean } | undefined;
                const clickable = Boolean(onTitleClick && metaInfo?.canEdit);
                const titleDir = (item as GridItem).dir as ('ltr' | 'rtl' | 'auto') | undefined;
                return (
                  <div
                    key={item.key}
                    className={styles.presentationItem}
                    data-presentation-index={index}
                  >
                    {item.title && (
                      clickable ? (
                        <button
                          type="button"
                          className={styles.presentationTitle + ' ' + styles.presentationTitleButton}
                          title={item.title}
                          onClick={() => { onTitleClick?.(item); }}
                          dir={titleDir}
                        >
                          {item.title}
                        </button>
                      ) : (
                        <div className={styles.presentationTitle} title={item.title} dir={titleDir}>{item.title}</div>
                      )
                    )}
                    <div className={styles.presentationImageWrap}>
                      <img
                        src={item.src}
                        alt=""
                        className={styles.presentationImg}
                        onClick={() => { void onToggle(item); }}
                      />
                      <div
                        className={
                          styles.presentationLikeBadge +
                          (meta.likedByMe ? ' ' + styles.presentationLikeBadgeLiked : '')
                        }
                        aria-hidden="true"
                      >
                        <span>❤</span>
                        <span>{meta.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {currentItem && (
          <>
            <div
              className={styles.mobileImageWrap}
              onClick={openPresentationMode}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
            >
              <img src={currentItem.src} alt="" className={styles.mobileImage} />
              {currentItem.title && (() => {
                const metaInfo = currentItem.meta as { canEdit?: boolean } | undefined;
                const clickable = Boolean(onTitleClick && metaInfo?.canEdit);
                const titleDir = (currentItem as GridItem).dir as ('ltr' | 'rtl' | 'auto') | undefined;
                if (clickable) {
                  return (
                    <button
                      type="button"
                      className={styles.mobileTitle + ' ' + styles.mobileTitleButton}
                      title={currentItem.title}
                      onClick={(e) => { e.stopPropagation(); onTitleClick?.(currentItem); }}
                      dir={titleDir}
                    >
                      {currentItem.title}
                    </button>
                  );
                }
                return (
                  <div className={styles.mobileTitle} title={currentItem.title} dir={titleDir}>{currentItem.title}</div>
                );
              })()}
              {currentMeta && (
                <button
                  type="button"
                  className={
                    styles.mobileLikeBadge +
                    (showGestureHint ? ' ' + styles.mobileLikeBadgeRaised : '') +
                    (currentMeta.likedByMe ? ' ' + styles.mobileLikeBadgeLiked : '')
                  }
                  onClick={(e) => { e.stopPropagation(); void onToggle(currentItem); }}
                  aria-label={currentMeta.likedByMe ? (t('unlike') as string) : (t('like') as string)}
                >
                  <span>❤</span>
                  <span>{currentMeta.count}</span>
                </button>
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
          const metaInfo = it.meta as { canEdit?: boolean } | undefined;
          const clickable = Boolean(onTitleClick && metaInfo?.canEdit);
          const titleDir = (it as GridItem).dir as ('ltr' | 'rtl' | 'auto') | undefined;
          return (
            <div key={it.key} className={styles.thumbWrap}>
              <img
                src={it.src}
                alt=""
                className={styles.thumb}
                onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              />
              {it.title && (
                clickable ? (
                  <button
                    type="button"
                    className={styles.titleBadge + ' ' + styles.titleBadgeButton}
                    title={it.title}
                    onClick={(e) => { e.stopPropagation(); onTitleClick?.(it); }}
                    dir={titleDir}
                  >
                    {it.title}
                  </button>
                ) : (
                  <div className={styles.titleBadge} title={it.title} dir={titleDir}>{it.title}</div>
                )
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
