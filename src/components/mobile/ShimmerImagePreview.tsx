'use client';

import React, { useState } from 'react';
import styles from './ShimmerImagePreview.module.css';

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface ShimmerImagePreviewProps {
  src: string;
  alt?: string;
  caption?: string;
}

export default function ShimmerImagePreview({ src, alt = '', caption }: ShimmerImagePreviewProps) {
  return (
    <div className={styles.demoRoot}>
      <ShimmerImage src={src} alt={alt} />
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </div>
  );
}

interface ShimmerImageProps {
  src: string;
  alt?: string;
  caption?: string;
  wrapperClassName?: string;
  imageClassName?: string;
  shimmerClassName?: string;
  loadingClassName?: string;
  hiddenClassName?: string;
  visibleClassName?: string;
  useDefaultStyles?: boolean;
  onLoadStateChange?: (loaded: boolean) => void;
}

export function ShimmerImage({
  src,
  alt = '',
  wrapperClassName,
  imageClassName,
  shimmerClassName,
  loadingClassName,
  hiddenClassName,
  visibleClassName,
  useDefaultStyles = true,
  onLoadStateChange,
}: ShimmerImageProps) {
  const [loaded, setLoaded] = useState(false);

  const handleLoaded = () => {
    if (!loaded) {
      setLoaded(true);
      onLoadStateChange?.(true);
    }
  };

  const baseWrapper = useDefaultStyles ? styles.imageShell : '';
  const baseImage = useDefaultStyles ? styles.image : '';
  const defaultHidden = useDefaultStyles ? styles.imageHidden : '';
  const defaultVisible = useDefaultStyles ? styles.imageVisible : '';

  const wrapperClass = joinClasses(
    baseWrapper,
    !loaded && useDefaultStyles && styles.loading,
    !loaded && loadingClassName,
    wrapperClassName
  );

  const shimmerClass = joinClasses(
    useDefaultStyles ? styles.shimmer : '',
    shimmerClassName
  );

  const hiddenClass = hiddenClassName || defaultHidden;
  const visibleClass = visibleClassName || defaultVisible;

  const imageClass = joinClasses(
    baseImage,
    loaded ? visibleClass : hiddenClass,
    imageClassName
  );

  return (
    <div className={wrapperClass}>
      {!loaded ? <div className={shimmerClass} aria-hidden="true" /> : null}
      <img
        src={src}
        alt={alt}
        className={imageClass}
        onLoad={handleLoaded}
        onError={handleLoaded}
      />
    </div>
  );
}
