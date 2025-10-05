'use client';

import React from 'react';
import styles from './SweepableContainer.module.css';

interface SweepableElementProps {
  label: string;
  background?: string;
  children?: React.ReactNode;
}

export default function SweepableElement({ label, background, children }: SweepableElementProps) {
  const style = background ? { background } : undefined;

  return (
    <div className={styles.swipeSlide} aria-label={label} style={style}>
      <div className={styles.slideContent}>{children}</div>
    </div>
  );
}

export type { SweepableElementProps };
