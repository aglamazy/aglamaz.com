'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './SweepableContainer.module.css';
import type { SweepableElementProps } from './SweepableElement';

interface SwipableContainerProps {
  children: React.ReactElement<SweepableElementProps>[];
  indicatorLabel?: string;
}

export default function SweepableContainer({ children, indicatorLabel }: SwipableContainerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);

  const slides = useMemo(
    () => React.Children.toArray(children) as React.ReactElement<SweepableElementProps>[],
    [children]
  );

  const initialIndex = slides.length > 1 ? 1 : 0;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<0 | 1 | -1>(0);

  useEffect(() => {
    const desired = slides.length > 1 ? 1 : 0;
    setActiveIndex((prev) => {
      if (slides.length === 0) {
        setDirection(0);
        return 0;
      }

      const clamped = Math.max(0, Math.min(prev, slides.length - 1));
      if (clamped !== prev) {
        setDirection(0);
        return clamped;
      }

      if (!hasInteractedRef.current && clamped !== desired) {
        setDirection(0);
        return desired;
      }

      return clamped;
    });
  }, [slides.length]);

  const goToIndex = (next: number) => {
    setActiveIndex((prev) => {
      if (slides.length === 0) return 0;
      const clamped = Math.max(0, Math.min(next, slides.length - 1));
      if (clamped === prev) {
        setDirection(0);
        return prev;
      }
      hasInteractedRef.current = true;
      setDirection(clamped > prev ? 1 : -1);
      return clamped;
    });
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchEndX.current = null;
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    touchEndX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchEndX.current - touchStartX.current;
    const threshold = 40;

    if (Math.abs(delta) < threshold) {
      touchStartX.current = null;
      touchEndX.current = null;
      return;
    }

    if (delta < 0) {
      goToIndex(activeIndex + 1);
    } else {
      goToIndex(activeIndex - 1);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    touchStartX.current = event.clientX;
    touchEndX.current = null;
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
  };

  const handleMouseMove = (event: MouseEvent) => {
    touchEndX.current = event.clientX;
  };

  const handleMouseUp = (event: MouseEvent) => {
    touchEndX.current = event.clientX;
    const delta = touchEndX.current - (touchStartX.current ?? touchEndX.current);
    const threshold = 40;

    if (Math.abs(delta) >= threshold) {
      if (delta < 0) {
        goToIndex(activeIndex + 1);
      } else {
        goToIndex(activeIndex - 1);
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleMouseMove);
  };

  useEffect(() => () => {
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const activeSlide = slides[activeIndex] ?? slides[0] ?? null;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: '0%', opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  } as const;

  return (
    <div className={styles.container}>
      <div
        className={styles.swipeViewport}
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <AnimatePresence initial={false} custom={direction}>
          {activeSlide ? (
            <motion.div
              key={activeIndex}
              className={styles.slideWrapper}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {React.cloneElement(activeSlide, {})}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div
        className={styles.swipeIndicators}
        role="tablist"
        aria-label={indicatorLabel || 'Sections'}
      >
        {slides.map((slide, index) => (
          <button
            key={slide.props.label ?? index}
            type="button"
            className={index === activeIndex ? `${styles.indicator} ${styles.indicatorActive}` : styles.indicator}
            onClick={() => goToIndex(index)}
            aria-label={slide.props.label}
            aria-selected={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
}
