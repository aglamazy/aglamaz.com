"use client";
import React, { useEffect, useRef } from "react";
import styles from './Loader.module.css';
import { useTranslation } from 'react-i18next';

type LoaderProps = {
  text?: string;            // Optional label next to the spinner
  size?: number;            // Spinner diameter in px (default 40)
  thickness?: number;       // Border width in px (default 4)
  fullscreen?: boolean;     // Fixed overlay covering the screen
  overlay?: boolean;        // Absolute overlay covering the parent
  blur?: boolean;           // Dim/blur the background for overlays
  className?: string;       // Extra classes for the wrapper
};

export const Loader: React.FC<LoaderProps> = ({
                                         text,
                                         size = 40,
                                         thickness = 4,
                                         fullscreen = false,
                                         overlay = false,
                                         blur = true,
                                         className = "",
                                       }) => {
  const base = "grid place-items-center";
  const surface = blur ? "bg-white/70 backdrop-blur-sm" : "bg-transparent";

  // Choose wrapper mode
  const wrapper = fullscreen
    ? `fixed inset-0 z-50 ${surface} ${base}`
    : overlay
      ? `absolute inset-0 ${surface} ${base}`
      : base;

  const spinnerRef = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (spinnerRef.current) {
      spinnerRef.current.style.setProperty('--loader-size', `${size}px`);
      spinnerRef.current.style.setProperty('--loader-thickness', `${thickness}px`);
    }
  }, [size, thickness]);

  return (
    <div
      className={`${wrapper} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <div
          ref={spinnerRef}
          className={`animate-spin rounded-full border-gray-300 border-t-gray-700 ${styles.spinner}`}
        />
        {text ? (
          <span className="text-sm text-slate-700">{text}</span>
        ) : (
          <span className="sr-only">{t('loading') as string}</span>
        )}
      </div>
    </div>
  );
};

export default Loader;
