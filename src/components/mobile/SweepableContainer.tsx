'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './SweepableContainer.module.css';
import type { SweepableElementProps } from './SweepableElement';

interface SweepableContainerProps {
  children: React.ReactElement<SweepableElementProps>[];
  indicatorLabel?: string;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export default function SweepableContainer({
  children,
  indicatorLabel,
  activeIndex: controlledActiveIndex,
  onActiveIndexChange,
}: SweepableContainerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);

  const slides = useMemo(
    () => React.Children.toArray(children) as React.ReactElement<SweepableElementProps>[],
    [children]
  );

  const isControlled = typeof controlledActiveIndex === 'number';

  const clampIndex = useCallback(
    (value: number) => {
      if (slides.length === 0) return 0;
      return Math.max(0, Math.min(value, slides.length - 1));
    },
    [slides.length]
  );

  const defaultIndex = slides.length > 1 ? 1 : 0;
  const initialIndex = clampIndex(
    isControlled && controlledActiveIndex !== undefined ? controlledActiveIndex : defaultIndex
  );

  const [internalActiveIndex, setInternalActiveIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<0 | 1 | -1>(0);

  useEffect(() => {
    setInternalActiveIndex((prev) => {
      const clamped = clampIndex(prev);
      if (clamped !== prev) {
        setDirection(0);
        return clamped;
      }

      if (!isControlled) {
        const desired = defaultIndex;
        if (!hasInteractedRef.current && clamped !== desired) {
          setDirection(0);
          return desired;
        }
      }

      return clamped;
    });
  }, [clampIndex, defaultIndex, isControlled]);

  useEffect(() => {
    if (!isControlled || controlledActiveIndex === undefined) return;
    const desired = clampIndex(controlledActiveIndex);
    setInternalActiveIndex((prev) => {
      if (prev === desired) {
        return prev;
      }
      setDirection(desired > prev ? 1 : -1);
      return desired;
    });
  }, [clampIndex, controlledActiveIndex, isControlled]);

  const goToIndex = (next: number) => {
    if (slides.length === 0) return;
    const currentIndex = internalActiveIndex;
    const clamped = clampIndex(next);
    if (clamped === currentIndex) {
      setDirection(0);
      return;
    }

    hasInteractedRef.current = true;
    setDirection(clamped > currentIndex ? 1 : -1);
    setInternalActiveIndex(clamped);
    onActiveIndexChange?.(clamped);
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    touchStartX.current = touch?.clientX ?? null;
    touchStartY.current = touch?.clientY ?? null;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    touchEndX.current = touch?.clientX ?? null;
    touchEndY.current = touch?.clientY ?? null;
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = (touchEndY.current ?? touchStartY.current ?? 0) - (touchStartY.current ?? 0);
    const threshold = 40;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      touchStartX.current = null;
      touchEndX.current = null;
      touchStartY.current = null;
      touchEndY.current = null;
      return;
    }

    if (Math.abs(deltaX) < threshold) {
      touchStartX.current = null;
      touchEndX.current = null;
      touchStartY.current = null;
      touchEndY.current = null;
      return;
    }

    if (deltaX < 0) {
      goToIndex(internalActiveIndex + 1);
    } else {
      goToIndex(internalActiveIndex - 1);
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
  };

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    touchStartX.current = event.clientX;
    touchStartY.current = event.clientY;
    touchEndX.current = null;
    touchEndY.current = null;
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
  };

  const handleMouseMove = (event: MouseEvent) => {
    touchEndX.current = event.clientX;
    touchEndY.current = event.clientY;
  };

  const handleMouseUp = (event: MouseEvent) => {
    touchEndX.current = event.clientX;
    touchEndY.current = event.clientY;
    const deltaX = touchEndX.current - (touchStartX.current ?? touchEndX.current);
    const deltaY = touchEndY.current - (touchStartY.current ?? touchEndY.current);
    const threshold = 40;

    if (Math.abs(deltaY) <= Math.abs(deltaX) && Math.abs(deltaX) >= threshold) {
      if (deltaX < 0) {
        goToIndex(internalActiveIndex + 1);
      } else {
        goToIndex(internalActiveIndex - 1);
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleMouseMove);
  };

  useEffect(() => () => {
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const activeSlide = slides[internalActiveIndex] ?? slides[0] ?? null;

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
              key={internalActiveIndex}
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
            className={
              index === internalActiveIndex
                ? `${styles.indicator} ${styles.indicatorActive}`
                : styles.indicator
            }
            onClick={() => goToIndex(index)}
            aria-label={slide.props.label}
            aria-selected={index === internalActiveIndex}
          />
        ))}
      </div>
    </div>
  );
}
