"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import I18nText from '@/components/I18nText';
import { useTranslation } from 'react-i18next';
import ImageGrid, { type GridItem, type LikeMeta } from '@/components/media/ImageGrid';
import OccurrenceEditModal, { OccurrenceForEdit } from '@/components/anniversaries/OccurrenceEditModal';
import GalleryPhotoEditModal, { GalleryPhotoForEdit } from '@/components/photos/GalleryPhotoEditModal';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { formatLocalizedDate } from '@/utils/dateFormat';
import type { ImageLikeMeta } from '@/types/likes';
import { useAddAction } from '@/hooks/useAddAction';
import { ApiRoute } from '@/utils/urls';

type ImageSizes = {
  original: string;
  '400x400': string;
  '800x800': string;
  '1200x1200': string;
  width: number;
  height: number;
};

type Occurrence = {
  id: string;
  type?: 'occurrence' | 'gallery';
  eventId?: string;
  anniversaryId?: string;
  date: any;
  imagesResized?: ImageSizes[];
  createdBy?: string;
  description?: string;
};

type AuthorInfo = { displayName: string; email: string };

const ITEMS_PER_PAGE = 10;

export default function PhotosPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const memberRole = useMemberStore((state) => state.member?.role);
  const site = useSiteStore((state) => state.siteInfo);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Occurrence[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [eventNames, setEventNames] = useState<Record<string, { name: string }>>({});
  const [likes, setLikes] = useState<Record<string, ImageLikeMeta[]>>({});
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [editTarget, setEditTarget] = useState<{ annId: string; occId: string } | null>(null);
  const [galleryEditTarget, setGalleryEditTarget] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const currentUserId = user?.user_id ?? '';
  const isAdmin = memberRole === 'admin';
  const textDirection: 'ltr' | 'rtl' = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';

  useAddAction(() => router.push('/app/photo/new'));

  const canEditOccurrence = useCallback(
    (creatorId?: string) => {
      if (!creatorId) return false;
      if (isAdmin) return true;
      if (!currentUserId) return false;
      return creatorId === currentUserId;
    },
    [isAdmin, currentUserId]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!editTarget) return;
    const occ = items.find((item) => item.id === editTarget.occId);
    if (!occ || !canEditOccurrence(occ.createdBy)) {
      setEditTarget(null);
    }
  }, [editTarget, items, canEditOccurrence]);

  const loadFeed = useCallback(async (pageNum = 0): Promise<boolean> => {
    if (!mountedRef.current) return false;

    const isInitialLoad = pageNum === 0;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError('');
    try {
      const offset = pageNum * ITEMS_PER_PAGE;
      const data = await apiFetch<{
        items: Occurrence[];
        events?: Record<string, { name: string }>;
        authors?: Record<string, { displayName: string; email: string }>;
      }>(ApiRoute.SITE_PICTURES, {
        queryParams: {
          locale: i18n.language,
          limit: String(ITEMS_PER_PAGE),
          offset: String(offset),
        },
      });
      if (!mountedRef.current) return false;
      const list: Occurrence[] = Array.isArray(data.items) ? data.items : [];

      setHasMore(list.length === ITEMS_PER_PAGE);

      if (isInitialLoad) {
        setItems(list);
      } else {
        setItems(prev => [...prev, ...list]);
      }

      setEventNames(prev => ({ ...prev, ...(data.events || {}) }));

      const rawAuthors = data.authors;
      if (!rawAuthors || typeof rawAuthors !== 'object') {
        throw new Error('[PhotosPage] authors payload missing');
      }
      const normalizedAuthors: Record<string, AuthorInfo> = {};
      for (const [id, info] of Object.entries(rawAuthors)) {
        if (!info || typeof info !== 'object') {
          throw new Error(`[PhotosPage] invalid author payload for ${id}`);
        }
        const displayName = (info as any).displayName?.trim();
        const email = (info as any).email?.trim();
        if (!displayName || !email) {
          throw new Error(`[PhotosPage] incomplete author data for ${id}`);
        }
        normalizedAuthors[id] = { displayName, email };
      }
      if (!mountedRef.current) return true;
      setAuthors(prev => ({ ...prev, ...normalizedAuthors }));

      const likesMap: Record<string, ImageLikeMeta[]> = {};
      await Promise.all(
        list.map(async (occ) => {
          try {
            const likeResponse = occ.type === 'gallery'
              ? await apiFetch<{ items: ImageLikeMeta[] }>(ApiRoute.SITE_PHOTO_IMAGE_LIKES, {
                  pathParams: { photoId: occ.id },
                })
              : await apiFetch<{ items: ImageLikeMeta[] }>(ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES, {
                  pathParams: { anniversaryId: occ.eventId!, eventId: occ.id },
                });

            likesMap[occ.id] = Array.isArray(likeResponse.items) ? likeResponse.items : [];
          } catch (err) {
            console.error('[photos] like fetch failed', err);
          }
        })
      );
      if (!mountedRef.current) return true;
      setLikes(prev => ({ ...prev, ...likesMap }));
      return true;
    } catch (e) {
      console.error('[photos] load error', e);
      if (mountedRef.current) setError('load');
      return false;
    } finally {
      if (mountedRef.current) {
        if (isInitialLoad) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    }
  }, [i18n.language]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    const success = await loadFeed(nextPage);
    if (success) {
      setPage(nextPage);
    }
  }, [loadFeed, loadingMore, hasMore, page]);

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollHeight - scrollTop - clientHeight < 500) {
        void loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, hasMore]);

  const gridItems = useMemo((): GridItem[] => {
    const flat: GridItem[] = [];
    for (const occ of items) {
      const eventImages = occ.imagesResized || [];
      const occDescriptionRaw = typeof occ.description === 'string' ? occ.description : '';
      const occDescription = occDescriptionRaw.trim();
      const annId = occ.eventId || occ.anniversaryId || '';
      const eventNameRaw = eventNames[annId]?.name;
      const eventName = typeof eventNameRaw === 'string' ? eventNameRaw.trim() : '';
      const d = occ.date as any;
      const sec = d?._seconds ?? d?.seconds;
      const js = typeof sec === 'number' ? new Date(sec * 1000) : (d?.toDate ? d.toDate() : new Date(d));
      const dateText = formatLocalizedDate(js, i18n.language);
      const baseLabel = occDescription || eventName;
      const title = [baseLabel, dateText].filter(Boolean).join(' — ');

      eventImages.forEach((image, i) => {
        const creatorId = occ.createdBy;
        if (!creatorId) {
          throw new Error(`[PhotosPage] missing creatorId for ${occ.type || 'item'} ${occ.id}`);
        }
        const canEdit = canEditOccurrence(creatorId);

        flat.push({
          key: `${occ.id}:${i}`,
          src: image['400x400'] || image.original,
          lightboxSrc: image['1200x1200'] || image.original,
          title: i === 0 ? title : undefined,
          dir: textDirection,
          meta: { occId: occ.id, annId, idx: i, canEdit, type: occ.type, creatorId },
        });
      });
    }
    return flat;
  }, [items, eventNames, textDirection, canEditOccurrence, i18n.language]);

  function getLikeMeta(occId: string, idx: number): ImageLikeMeta {
    const arr = likes[occId] || [];
    return arr.find((l) => l.index === idx) || { index: idx, count: 0, likedByMe: false, likers: [] };
  }

  const getGridMeta = useCallback((item: GridItem): LikeMeta => {
    const m = item.meta as { occId: string; idx: number };
    const meta = getLikeMeta(m.occId, m.idx);
    return { count: meta.count, likedByMe: meta.likedByMe, likers: meta.likers };
  }, [likes]);

  const handleGridToggle = useCallback(async (item: GridItem) => {
    const m = item.meta as { occId: string; annId: string; idx: number; type?: 'occurrence' | 'gallery' };
    await toggleLike(m.annId, m.occId, m.idx, m.type);
  }, []);

  const handleTitleClick = useCallback((item: GridItem) => {
    const m = item.meta as { occId: string; annId: string; canEdit: boolean; type?: 'occurrence' | 'gallery'; creatorId: string };
    if (!m.canEdit) return;
    if (m.type === 'gallery') {
      setGalleryEditTarget(m.occId);
    } else {
      setEditTarget({ annId: m.annId, occId: m.occId });
    }
  }, []);

  const handleOccurrenceUpdated = (updated: OccurrenceForEdit) => {
    setItems((prev) => prev.map((occ) => (occ.id === updated.id ? { ...occ, ...updated } : occ)));
  };

  const handleGalleryPhotoUpdated = (updated: GalleryPhotoForEdit) => {
    if (updated.images.length === 0) {
      setItems((prev) => prev.filter((item) => item.id !== updated.id));
    } else {
      setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    }
  };

  const currentOccurrence = useMemo(() => {
    if (!editTarget) return null;
    return items.find((occ) => occ.id === editTarget.occId) ?? null;
  }, [editTarget, items]);

  const currentGalleryPhoto = useMemo(() => {
    if (!galleryEditTarget) return null;
    return items.find((item) => item.id === galleryEditTarget) ?? null;
  }, [galleryEditTarget, items]);

  const canEditCurrent = editTarget && currentOccurrence ? canEditOccurrence(currentOccurrence.createdBy) : false;

  async function toggleLike(annId: string, occId: string, idx: number, type?: 'occurrence' | 'gallery') {
    const meta = getLikeMeta(occId, idx);
    const next: ImageLikeMeta = { ...meta, likedByMe: !meta.likedByMe, count: meta.count + (meta.likedByMe ? -1 : 1) };
    setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), next].sort((a, b) => a.index - b.index) }));
    try {
      const data = type === 'gallery'
        ? await apiFetch<ImageLikeMeta>(ApiRoute.SITE_PHOTO_IMAGE_LIKES, {
            method: 'POST',
            pathParams: { photoId: occId },
            body: { imageIndex: idx, like: !meta.likedByMe },
          })
        : await apiFetch<ImageLikeMeta>(ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES, {
            method: 'POST',
            pathParams: { anniversaryId: annId, eventId: occId },
            body: { imageIndex: idx, like: !meta.likedByMe },
          });

      setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), data].sort((a, b) => a.index - b.index) }));
    } catch (e) {
      console.error('[photos] like toggle failed', e);
      setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), meta].sort((a, b) => a.index - b.index) }));
    }
  }

  if (loading) return <div className="p-4"><I18nText k="loading" /></div>;
  if (error) return <div className="p-4"><I18nText k="somethingWentWrong" /></div>;

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-lg text-sage-600 font-medium">
            {t('noPicturesYet')}
          </p>
          <p className="text-sage-500">
            {t('wouldYouLikeToPostFirst')}
          </p>
          <button
            onClick={() => router.push('/app/photo/new')}
            className="mt-6 px-6 py-3 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
          >
            {t('uploadPhoto')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 max-w-6xl mx-auto">
        <ImageGrid
          items={gridItems}
          getMeta={getGridMeta}
          onToggle={handleGridToggle}
          onTitleClick={handleTitleClick}
        />
        {loadingMore && (
          <div className="p-4 text-center text-gray-500">
            {t('loading')}...
          </div>
        )}
      </div>

      {editTarget && currentOccurrence && canEditCurrent && (
        <OccurrenceEditModal
          anniversaryId={editTarget.annId}
          occurrenceId={editTarget.occId}
          isOpen={true}
          onClose={() => setEditTarget(null)}
          onUpdated={handleOccurrenceUpdated}
          initialOccurrence={currentOccurrence as OccurrenceForEdit | null}
        />
      )}

      {galleryEditTarget && currentGalleryPhoto && (
        <GalleryPhotoEditModal
          photoId={galleryEditTarget}
          isOpen={true}
          onClose={() => setGalleryEditTarget(null)}
          onUpdated={handleGalleryPhotoUpdated}
          initialPhoto={currentGalleryPhoto as GalleryPhotoForEdit | null}
        />
      )}
    </>
  );
}
