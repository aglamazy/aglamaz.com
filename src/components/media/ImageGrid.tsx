"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './ImageGrid.module.css';
import { useTranslation } from 'react-i18next';
import { usePresentationModeStore } from '@/store/PresentationModeStore';
import type { LikerInfo } from '@/types/likes';
import LikersPopover from '@/components/photos/LikersPopover';
import { AppRoute, getPath } from '@/utils/urls';

export interface GridItem {
  key: string;
  src: string;
  lightboxSrc?: string; // Optional higher-res image for lightbox view
  title?: string;
  meta?: Record<string, unknown>;
  dir?: 'ltr' | 'rtl' | 'auto';
  mediaType?: 'image' | 'video';
  // Height/width ratio of the source image, used by the JS row-major masonry
  // (useJsMasonry) to size tiles without waiting for the image to load.
  // Falls back to a square tile when omitted.
  aspectRatio?: number;
}

export interface LikeMeta {
  count: number;
  likedByMe: boolean;
  likers: LikerInfo[];
}

interface ImageGridProps {
  items: GridItem[];
  getMeta: (item: GridItem) => LikeMeta;
  onToggle: (item: GridItem) => Promise<void> | void;
  onTitleClick?: (item: GridItem) => void;
  getLightboxLink?: (item: GridItem) => string | undefined;
  autoSlideshow?: boolean;
  // Opt-in row-major (Pinterest-style) JS masonry instead of the default
  // CSS column-count masonry. CSS column-count fills column-major (balances
  // height column-by-column), which buries newest items in paginated feeds
  // that rely on DOM order == chronological order (see famcircle#72). Only
  // enable this where callers supply per-item `aspectRatio` (or accept the
  // square-tile fallback) — the digest email's masonry collage is a
  // separate, non-React, inlined-CSS render and is unaffected either way.
  useJsMasonry?: boolean;
}

export default function ImageGrid({ items, getMeta, onToggle, onTitleClick, getLightboxLink, autoSlideshow, useJsMasonry }: ImageGridProps) {
  const { t, i18n } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const [slideshowSeconds, setSlideshowSeconds] = useState(6);
  const [slideshowPrev, setSlideshowPrev] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [likersPopover, setLikersPopover] = useState<{ item: GridItem; anchorEl: HTMLElement } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const autoSlideshowTriggered = useRef(false);
  const prefetchedSrc = useRef<Set<string>>(new Set());
  const presentationListRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridColumnCount, setGridColumnCount] = useState(4);
  const [gridWidth, setGridWidth] = useState(0);

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

  // Mirrors the .imagesGrid CSS column-count breakpoints so the JS masonry
  // (when enabled) lays out the same number of columns as the CSS fallback.
  useEffect(() => {
    if (!useJsMasonry || typeof window === 'undefined') return;
    const updateColumns = () => {
      const w = window.innerWidth;
      setGridColumnCount(w >= 1024 ? 4 : w >= 768 ? 3 : 2);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [useJsMasonry]);

  // Measure synchronously (before paint) so the first render already has the
  // real width where possible, avoiding a flash of CSS-column fallback layout.
  useLayoutEffect(() => {
    if (!useJsMasonry || isMobile) return;
    const el = gridContainerRef.current;
    if (!el) return;
    setGridWidth(el.getBoundingClientRect().width);
  }, [useJsMasonry, isMobile, gridColumnCount, items.length]);

  useEffect(() => {
    if (!useJsMasonry || isMobile) return;
    const el = gridContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setGridWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [useJsMasonry, isMobile]);

  // Row-major (Pinterest-style) masonry: place each item, in existing DOM
  // order (newest-first per GalleryPhotoRepository), into whichever column
  // currently has the least accumulated height. This keeps reading order
  // (and therefore chronological order) tracking visual position, unlike
  // CSS column-count which balances height column-by-column first.
  const masonryLayout = useMemo(() => {
    if (!useJsMasonry || isMobile || gridWidth <= 0 || gridColumnCount <= 0) return null;
    const gap = 8; // matches .imagesGrid's column-gap: 0.5rem
    const cols = gridColumnCount;
    const columnWidth = (gridWidth - gap * (cols - 1)) / cols;
    if (columnWidth <= 0) return null;
    const columnHeights = new Array(cols).fill(0);
    const positions = items.map((item) => {
      const ratio = item.aspectRatio && item.aspectRatio > 0 ? item.aspectRatio : 1;
      const height = columnWidth * ratio;
      let col = 0;
      for (let c = 1; c < cols; c++) {
        if (columnHeights[c] < columnHeights[col]) col = c;
      }
      const top = columnHeights[col];
      columnHeights[col] = top + height + gap;
      return { top, left: col * (columnWidth + gap), width: columnWidth };
    });
    const tallest = Math.max(...columnHeights);
    return { positions, containerHeight: tallest > 0 ? tallest - gap : 0 };
  }, [useJsMasonry, isMobile, items, gridColumnCount, gridWidth]);

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return;

    const newSources = items
      .filter((item) => item.mediaType !== 'video')
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

  // Stop slideshow when lightbox closes
  useEffect(() => {
    if (!lightboxOpen) {
      setSlideshowPlaying(false);
      setSlideshowPrev(null);
    }
  }, [lightboxOpen]);

  // Auto-start slideshow when prop is set and items are ready
  useEffect(() => {
    if (!autoSlideshow || autoSlideshowTriggered.current || isMobile || items.length === 0) return;
    autoSlideshowTriggered.current = true;
    setLightboxIndex(0);
    setLightboxOpen(true);
    setSlideshowPlaying(true);
  }, [autoSlideshow, isMobile, items.length]);

  // Slideshow auto-advance timer (skip video items)
  useEffect(() => {
    if (!slideshowPlaying || !lightboxOpen || items.length <= 1) return;
    const id = setInterval(() => {
      setLightboxIndex((prev) => {
        setSlideshowPrev(prev);
        let next = (prev + 1) % items.length;
        // Skip video items during auto-advance
        let attempts = 0;
        while (items[next]?.mediaType === 'video' && attempts < items.length) {
          next = (next + 1) % items.length;
          attempts++;
        }
        return next;
      });
    }, slideshowSeconds * 1000);
    return () => clearInterval(id);
  }, [slideshowPlaying, lightboxOpen, items.length, slideshowSeconds, items]);

  // Clear slideshowPrev after crossfade transition
  useEffect(() => {
    if (slideshowPrev === null) return;
    const id = setTimeout(() => setSlideshowPrev(null), 1100);
    return () => clearTimeout(id);
  }, [slideshowPrev]);

  // Preload upcoming lightbox images during slideshow (skip videos)
  useEffect(() => {
    if (!slideshowPlaying || !lightboxOpen || items.length === 0) return;
    for (let offset = 1; offset <= 2; offset++) {
      const idx = (lightboxIndex + offset) % items.length;
      if (items[idx].mediaType === 'video') continue;
      const src = items[idx].lightboxSrc || items[idx].src;
      if (src && !prefetchedSrc.current.has(src)) {
        const img = new Image();
        img.src = src;
        prefetchedSrc.current.add(src);
      }
    }
  }, [slideshowPlaying, lightboxOpen, lightboxIndex, items]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!lightboxOpen || items.length === 0) return;
      if (e.key === 'Escape') { e.preventDefault(); setSlideshowPlaying(false); setLightboxOpen(false); }
      else if (e.key === ' ') { e.preventDefault(); setSlideshowPlaying((p) => !p); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setSlideshowPlaying(false); setLightboxIndex((p) => (p - 1 + items.length) % items.length); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setSlideshowPlaying(false); setLightboxIndex((p) => (p + 1) % items.length); }
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
                      {item.mediaType === 'video' ? (
                        <video
                          src={item.src}
                          controls
                          playsInline
                          className={styles.presentationImg}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <img
                          src={item.src}
                          alt=""
                          className={styles.presentationImg}
                          onClick={() => { void onToggle(item); }}
                        />
                      )}
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
              {currentItem.mediaType === 'video' ? (
                <video src={currentItem.src} controls playsInline className={styles.mobileImage} onClick={(e) => e.stopPropagation()} />
              ) : (
                <img src={currentItem.src} alt="" className={styles.mobileImage} />
              )}
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
      <div
        className={styles.imagesGrid}
        ref={gridContainerRef}
        style={masonryLayout ? { position: 'relative', height: masonryLayout.containerHeight } : undefined}
      >
        {items.map((it, i) => {
          const meta = getMeta(it);
          const metaInfo = it.meta as { canEdit?: boolean } | undefined;
          const clickable = Boolean(onTitleClick && metaInfo?.canEdit);
          const titleDir = (it as GridItem).dir as ('ltr' | 'rtl' | 'auto') | undefined;
          const pos = masonryLayout?.positions[i];
          const thumbWrapStyle = pos
            ? { position: 'absolute' as const, top: pos.top, insetInlineStart: pos.left, width: pos.width, marginBottom: 0 }
            : undefined;
          return (
            <div key={it.key} className={styles.thumbWrap} style={thumbWrapStyle}>
              {it.mediaType === 'video' ? (
                <div
                  style={{ position: 'relative', cursor: 'pointer' }}
                  onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                >
                  <video
                    src={it.src}
                    muted
                    preload="metadata"
                    playsInline
                    className={styles.thumb}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 24, marginLeft: 3 }}>▶</span>
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={it.src}
                  alt=""
                  className={styles.thumb}
                  onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                />
              )}
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
              <div className={styles.likeContainer}>
                <button
                  type="button"
                  aria-label={meta.likedByMe ? (t('unlike') as string) : (t('like') as string)}
                  className={styles.likeBtn + (meta.likedByMe ? (' ' + styles.likeBtnLiked) : '')}
                  onClick={(e) => { e.stopPropagation(); onToggle(it); }}
                >
                  <span>❤</span>
                </button>
                {meta.count > 0 && !isMobile && (
                  <button
                    type="button"
                    className={styles.likeCount}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLikersPopover({ item: it, anchorEl: e.currentTarget });
                    }}
                    aria-label={t('showLikers') as string}
                  >
                    {meta.count}
                  </button>
                )}
                {(meta.count > 0 && isMobile) && (
                  <span className={styles.likeCountText}>{meta.count}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lightboxOpen && items.length > 0 && (() => {
        const lbItem = items[lightboxIndex];
        const lbLink = getLightboxLink?.(lbItem);
        const lbTitle = lbItem.title || (lbItem.meta as Record<string, unknown> | undefined)?.groupTitle as string | undefined;
        const kenBurnsClass = slideshowPlaying
          ? styles.kenBurnsActive + ' ' + styles[`kenBurns${(lightboxIndex % 3) + 1}` as keyof typeof styles]
          : '';
        return (
          <div className={styles.lightboxBackdrop} onClick={() => { setSlideshowPlaying(false); setLightboxOpen(false); }}>
            {lbTitle && (
              <div className={styles.lightboxHeader} dir={i18n.dir()} onClick={(e) => e.stopPropagation()}>
                {lbLink ? (
                  <Link href={lbLink} className={styles.lightboxHeaderLink} onClick={() => setLightboxOpen(false)}>
                    {lbTitle}
                  </Link>
                ) : (
                  <span className={styles.lightboxHeaderText}>{lbTitle}</span>
                )}
              </div>
            )}
            <button className={styles.navBtn + ' ' + styles.navLeft} onClick={(e) => { e.stopPropagation(); setSlideshowPlaying(false); setLightboxIndex((p) => (p - 1 + items.length) % items.length); }}>‹</button>

            {slideshowPlaying || slideshowPrev !== null ? (
              <div className={styles.lightboxImageContainer} onClick={(e) => e.stopPropagation()}>
                {slideshowPrev !== null && (
                  <div className={styles.crossfadeLayerBack}>
                    <img src={items[slideshowPrev].lightboxSrc || items[slideshowPrev].src} alt="" />
                  </div>
                )}
                <div className={styles.crossfadeLayerFront}>
                  {lbItem.mediaType === 'video' ? (
                    <video
                      src={lbItem.src}
                      controls
                      autoPlay
                      playsInline
                      key={`kb-${lightboxIndex}`}
                      style={{ maxHeight: '90vh', maxWidth: '90vw' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={lbItem.lightboxSrc || lbItem.src}
                      alt=""
                      className={kenBurnsClass}
                      style={slideshowPlaying ? { animationDuration: `${slideshowSeconds}s` } : undefined}
                      key={`kb-${lightboxIndex}`}
                    />
                  )}
                </div>
                {slideshowPlaying && (
                  <div
                    className={styles.slideshowProgressBar}
                    style={{ animationDuration: `${slideshowSeconds}s` }}
                    key={`prog-${lightboxIndex}`}
                  />
                )}
              </div>
            ) : lbItem.mediaType === 'video' ? (
              <video
                src={lbItem.src}
                controls
                autoPlay
                playsInline
                className={styles.lightboxImg}
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: '90vh', maxWidth: '90vw' }}
              />
            ) : (
              <img src={lbItem.lightboxSrc || lbItem.src} alt="" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
            )}

            <button className={styles.navBtn + ' ' + styles.navRight} onClick={(e) => { e.stopPropagation(); setSlideshowPlaying(false); setLightboxIndex((p) => (p + 1) % items.length); }}>›</button>

            <div className={styles.slideshowControls} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.slideshowPlayBtn}
                onClick={() => setSlideshowPlaying((p) => !p)}
                aria-label={t('slideshow') as string}
              >
                {slideshowPlaying ? '⏸' : '▶'}
                <span>{t('slideshow')}</span>
              </button>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={slideshowSeconds}
                onChange={(e) => setSlideshowSeconds(Number(e.target.value))}
                className={styles.slideshowSlider}
                aria-label="Speed"
              />
              <span className={styles.slideshowSliderLabel}>{slideshowSeconds}s</span>
              <button
                className={styles.slideshowShareBtn}
                onClick={() => {
                  const url = new URL(getPath(AppRoute.APP_SLIDESHOW), window.location.origin);
                  void navigator.clipboard.writeText(url.toString()).then(() => {
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  });
                }}
                aria-label={t('copyLink') as string}
              >
                {linkCopied ? '✓' : '🔗'}
              </button>
            </div>
          </div>
        );
      })()}

      {likersPopover && (
        <LikersPopover
          likers={getMeta(likersPopover.item).likers || []}
          onClose={() => setLikersPopover(null)}
          title={t('whoLiked') as string || 'Who liked this'}
          emptyLabel={t('noLikes') as string || 'No likes yet'}
          dir={i18n.dir()}
          language={i18n.language}
          anchorEl={likersPopover.anchorEl}
        />
      )}
    </>
  );
}
