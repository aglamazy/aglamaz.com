'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/utils/urls';
import type { ImageLikeMeta } from '@/types/likes';
import { LikeRequestTracker } from '@/utils/likeRequestTracker';

/** Image index -> its likes. Read BY INDEX, never by position: the indexes are sparse. */
export type LikesByIndex = Record<number, ImageLikeMeta>;

export interface WantedLike {
  id: string;
  type: 'gallery' | 'occurrence';
  index: number;
}

/**
 * Likes for the picture feeds, asked only for the photos on screen (famcircle#199,
 * option a). `requestLikes` is called with what is on screen now; indexes already asked
 * are dropped, so scrolling back costs nothing, and the rest go in ONE request.
 * A photo whose likes have not arrived reads as zero likes, exactly as before they loaded.
 */
export function usePictureLikes(logTag: string) {
  const [likes, setLikes] = useState<Record<string, LikesByIndex>>({});
  const trackerRef = useRef(new LikeRequestTracker());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestLikes = useCallback(
    (wanted: WantedLike[]) => {
      const byItem = new Map<string, { type: WantedLike['type']; indexes: number[] }>();
      for (const w of wanted) {
        const entry = byItem.get(w.id);
        if (entry) entry.indexes.push(w.index);
        else byItem.set(w.id, { type: w.type, indexes: [w.index] });
      }
      const items: Array<{ id: string; type: WantedLike['type']; indexes: number[] }> = [];
      for (const [id, { type, indexes }] of byItem) {
        const fresh = trackerRef.current.take(id, indexes);
        if (fresh.length > 0) items.push({ id, type, indexes: fresh });
      }
      if (items.length === 0) return;

      apiFetch<{ byIndex: Record<string, LikesByIndex> }>(ApiRoute.SITE_PICTURES_LIKES, {
        method: 'POST',
        body: { items },
      })
        .then((resp) => {
          if (!resp.byIndex || typeof resp.byIndex !== 'object') {
            throw new Error(`[${logTag}] likes response has no byIndex`);
          }
          if (!mountedRef.current) return;
          setLikes((prev) => {
            const next = { ...prev };
            for (const [id, perIndex] of Object.entries(resp.byIndex)) {
              next[id] = { ...(prev[id] || {}), ...perIndex };
            }
            return next;
          });
        })
        .catch((err) => {
          for (const it of items) trackerRef.current.release(it.id, it.indexes);
          console.error(`[${logTag}] likes fetch failed`, err);
        });
    },
    [logTag],
  );

  /** A reloaded feed asks again for what it shows; the likes already held stay until replaced. */
  const resetRequested = useCallback(() => {
    trackerRef.current.reset();
  }, []);

  const getLikeMeta = useCallback(
    (id: string, idx: number): ImageLikeMeta =>
      likes[id]?.[idx] ?? { index: idx, count: 0, likedByMe: false, likers: [] },
    [likes],
  );

  const setLikeMeta = useCallback((id: string, idx: number, meta: ImageLikeMeta) => {
    setLikes((cur) => ({ ...cur, [id]: { ...(cur[id] || {}), [idx]: meta } }));
  }, []);

  return { likes, requestLikes, resetRequested, getLikeMeta, setLikeMeta };
}
