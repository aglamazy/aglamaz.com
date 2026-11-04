'use client';

import { useCallback, useEffect, useRef, type RefCallback } from 'react';

/** How far beyond the viewport a tile counts as on screen, so likes land before it does. */
const ON_SCREEN_MARGIN = '300px 0px';

/**
 * Reports the keys of elements that come on screen (famcircle#199: likes are asked only
 * for the photos on screen). Attach `observe(key)` as a ref; `onShown` is called with
 * every key that entered the viewport in one batch - the browser groups entries per frame,
 * so a screenful arrives as one call, i.e. one likes request.
 */
export function useOnScreen(onShown: ((keys: string[]) => void) | undefined) {
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const enabled = Boolean(onShown);

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const keys: string[] = [];
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const key = (entry.target as HTMLElement).dataset.onScreenKey;
            if (key) keys.push(key);
          }
          if (keys.length > 0) onShownRef.current?.(keys);
        },
        { rootMargin: ON_SCREEN_MARGIN },
      );
    }
    return observerRef.current;
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  // One stable ref callback per key: a fresh function each render would make React
  // unobserve and re-observe every tile on every render.
  const refsRef = useRef(new Map<string, RefCallback<HTMLElement>>());
  return useCallback(
    (key: string): RefCallback<HTMLElement> | undefined => {
      if (!enabled) return undefined;
      let ref = refsRef.current.get(key);
      if (!ref) {
        ref = (el: HTMLElement | null) => {
          if (!el) return undefined;
          el.dataset.onScreenKey = key;
          const observer = getObserver();
          observer.observe(el);
          return () => {
            observer.unobserve(el);
          };
        };
        refsRef.current.set(key, ref);
      }
      return ref;
    },
    [enabled, getObserver],
  );
}
