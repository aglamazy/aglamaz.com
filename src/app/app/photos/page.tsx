"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import I18nText from '@/components/I18nText';
import { useTranslation } from 'react-i18next';
import ImageGrid, { type GridItem, type LikeMeta } from '@/components/media/ImageGrid';
import OccurrenceEditModal, { OccurrenceForEdit } from '@/components/anniversaries/OccurrenceEditModal';
import GalleryPhotoEditModal, { GalleryPhotoForEdit } from '@/components/photos/GalleryPhotoEditModal';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { useReadOnlyStore } from '@/store/ReadOnlyStore';
import { formatLocalizedDate } from '@/utils/dateFormat';
import type { ImageLikeMeta } from '@/types/likes';
import { useAddAction } from '@/hooks/useAddAction';
import AddFab from '@/components/ui/AddFab';
import { ApiRoute } from '@/utils/urls';

type ImageSizes = {
  original: string;
  [size: string]: string | number | undefined;
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
  videos?: string[];
  createdBy?: string;
  description?: string;
};

type AuthorInfo = { displayName: string; email: string };

const ITEMS_PER_PAGE = 10;

export default function PhotosPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoSlideshow = searchParams.get('slideshow') === '1';
  const user = useUserStore((state) => state.user);
  const memberRole = useMemberStore((state) => state.member?.role);
  const site = useSiteStore((state) => state.siteInfo);
  const isReadOnly = useReadOnlyStore((state) => state.isReadOnly);
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
      if (isReadOnly) return false;
      if (!creatorId) return false;
      if (isAdmin) return true;
      if (!currentUserId) return false;
      return creatorId === currentUserId;
    },
    [isReadOnly, isAdmin, currentUserId]
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

  // Date cursor for pagination (the date of the last-loaded item, or a
  // jump-to-date target) — see SITE_PICTURES's `before` param. Replaced the
  // old numeric offset: offset re-fetched every prior page on every request,
  // which made reaching old content (e.g. a 2018 photo) take dozens of
  // progressively-slower round trips (famcircle#79 follow-up). A date cursor
  // costs the same O(limit) at any depth, and doubles as the jump-to-date
  // mechanism — jumping just sets this to the target date instead of 0.
  const cursorRef = useRef<Date | undefined>(undefined);
  const loadingRef = useRef(false);

  const loadFeed = useCallback(async (pageNum = 0, limit = ITEMS_PER_PAGE, jumpCursor?: Date): Promise<boolean> => {
    if (!mountedRef.current) return false;
    if (loadingRef.current) return false;
    loadingRef.current = true;

    const isInitialLoad = pageNum === 0;
    if (isInitialLoad) {
      setLoading(true);
      cursorRef.current = jumpCursor;
    } else {
      setLoadingMore(true);
    }
    setError('');
    try {
      const data = await apiFetch<{
        items: Occurrence[];
        events?: Record<string, { name: string }>;
        authors?: Record<string, { displayName: string; email: string }>;
      }>(ApiRoute.SITE_PICTURES, {
        queryParams: {
          locale: i18n.language,
          limit: String(limit),
          sizes: '400x400,1200x1200',
          ...(cursorRef.current ? { before: cursorRef.current.toISOString() } : {}),
        },
      });
      if (!mountedRef.current) return false;
      const list: Occurrence[] = Array.isArray(data.items) ? data.items : [];

      if (list.length > 0) {
        const lastDate = list[list.length - 1].date as any;
        const sec = lastDate?._seconds ?? lastDate?.seconds;
        cursorRef.current = typeof sec === 'number' ? new Date(sec * 1000) : new Date(lastDate);
      }
      setHasMore(list.length === limit);

      if (isInitialLoad) {
        setItems(list);
      } else {
        setItems(prev => [...prev, ...list]);
      }

      setEventNames(prev => ({ ...prev, ...(data.events || {}) }));

      // Fire likes fetch immediately — don't wait for author processing
      const likesItems = list
        .filter((occ) => (occ.imagesResized?.length ?? 0) + (occ.videos?.length ?? 0) > 0)
        .map((occ) => ({
          id: occ.id,
          type: occ.type ?? 'occurrence',
          imageCount: (occ.imagesResized?.length ?? 0) + (occ.videos?.length ?? 0),
        }));
      if (likesItems.length > 0) {
        apiFetch<{ likes: Record<string, ImageLikeMeta[]> }>(ApiRoute.SITE_PICTURES_LIKES, {
          method: 'POST',
          body: { items: likesItems },
        })
          .then((resp) => {
            if (!mountedRef.current) return;
            if (resp.likes) {
              setLikes((prev) => ({ ...prev, ...resp.likes }));
            }
          })
          .catch((err) => console.error('[photos] batch likes fetch failed', err));
      }

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

      return true;
    } catch (e) {
      console.error('[photos] load error', e);
      if (mountedRef.current) setError('load');
      return false;
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        if (isInitialLoad) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    }
  }, [i18n.language]);

  // Initial load: in slideshow mode fetch just 1 item to start fast
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    if (autoSlideshow) {
      void loadFeed(0, 1).then((ok) => {
        if (ok && mountedRef.current) {
          // Immediately start loading the rest in the background
          void loadFeed(1);
        }
      });
    } else {
      void loadFeed();
    }
  }, [loadFeed, autoSlideshow]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    const success = await loadFeed(nextPage);
    if (success) {
      setPage(nextPage);
    }
  }, [loadFeed, loadingMore, hasMore, page]);

  // Jump-to-month: reloads the feed starting from the first day AFTER the
  // selected month, so `before` includes the whole month picked.
  const [jumpMonth, setJumpMonth] = useState('');
  const handleJumpToMonth = useCallback((value: string) => {
    setJumpMonth(value);
    if (!value) {
      setPage(0);
      void loadFeed(0);
      return;
    }
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return;
    const cursor = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // first moment of the NEXT month
    setPage(0);
    void loadFeed(0, ITEMS_PER_PAGE, cursor);
  }, [loadFeed]);

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

      const creatorId = occ.createdBy;
      if (!creatorId) {
        throw new Error(`[PhotosPage] missing creatorId for ${occ.type || 'item'} ${occ.id}`);
      }
      const canEdit = canEditOccurrence(creatorId);
      const occVideos = occ.videos || [];
      const groupSize = eventImages.length + occVideos.length;

      eventImages.forEach((image, i) => {
        const aspectRatio = image.width > 0 && image.height > 0 ? image.height / image.width : undefined;
        flat.push({
          key: `${occ.type}:${occ.id}:${i}`,
          src: (image['400x400'] as string) || image.original,
          lightboxSrc: (image['1200x1200'] as string) || image.original,
          title: i === 0 ? title : undefined,
          dir: textDirection,
          aspectRatio,
          meta: { occId: occ.id, annId, idx: i, canEdit, type: occ.type, creatorId, groupTitle: title, groupSize },
        });
      });

      // Add video items
      occVideos.forEach((videoUrl, vi) => {
        flat.push({
          key: `${occ.type}:${occ.id}:v${vi}`,
          src: videoUrl,
          title: eventImages.length === 0 && vi === 0 ? title : undefined,
          dir: textDirection,
          mediaType: 'video',
          meta: { occId: occ.id, annId, idx: eventImages.length + vi, canEdit, type: occ.type, creatorId, groupTitle: title, groupSize },
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

  const getLightboxLink = useCallback((item: GridItem): string | undefined => {
    const m = item.meta as { occId: string; annId: string; type?: 'occurrence' | 'gallery' };
    if (m.type === 'gallery' || !m.annId) return undefined;
    return `/app/anniversaries/${m.annId}/events/${m.occId}`;
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

  // Removes just this one image/video from its gallery post, without touching
  // the rest of that day's photos (famcircle#79 — pruning bulk-imported junk
  // shouldn't force an all-or-nothing choice per post). Gallery posts only —
  // anniversary-event photos still go through OccurrenceEditModal as a whole.
  const handleDeleteItem = useCallback(async (item: GridItem) => {
    const m = item.meta as { occId: string; idx: number; canEdit?: boolean; type?: 'occurrence' | 'gallery' };
    if (!m.canEdit) return;
    if (m.type !== 'gallery') {
      console.error('[PhotosPage] per-item delete is only supported for gallery posts, got', m.type);
      return;
    }
    if (!window.confirm(t('confirmDeletePhoto') || 'Are you sure you want to delete this photo?')) return;

    const occ = items.find((o) => o.id === m.occId);
    if (!occ) return;
    const images = occ.imagesResized || [];
    const videosList = occ.videos || [];

    const remainingImages = m.idx < images.length
      ? images.filter((_, i) => i !== m.idx)
      : images;
    const remainingVideos = m.idx >= images.length
      ? videosList.filter((_, vi) => images.length + vi !== m.idx)
      : videosList;

    try {
      const res = await apiFetch<{ success: boolean; deleted?: boolean }>(ApiRoute.SITE_PHOTO_BY_ID, {
        method: 'PUT',
        pathParams: { photoId: m.occId },
        body: {
          locale: i18n.language,
          imagesWithDimensions: remainingImages.map((img) => ({ url: img.original, width: img.width, height: img.height })),
          videos: remainingVideos,
        },
      });

      if (res.deleted || (remainingImages.length === 0 && remainingVideos.length === 0)) {
        setItems((prev) => prev.filter((o) => o.id !== m.occId));
      } else {
        setItems((prev) => prev.map((o) => (o.id === m.occId ? { ...o, imagesResized: remainingImages, videos: remainingVideos } : o)));
      }
    } catch (e) {
      console.error('[photos] delete item failed', e);
    }
  }, [items, i18n.language, t]);

  // Splits one image/video out of a multi-item gallery post into its own new
  // post, same date. For cases like a WhatsApp-day import where two unrelated
  // moments got bundled together just because they were shared the same day —
  // "delete" would lose the photo; this keeps it, just un-bundled.
  const handleDetachItem = useCallback(async (item: GridItem) => {
    const m = item.meta as { occId: string; idx: number; canEdit?: boolean; type?: 'occurrence' | 'gallery'; groupSize?: number };
    if (!m.canEdit) return;
    if (m.type !== 'gallery') {
      console.error('[PhotosPage] detach is only supported for gallery posts, got', m.type);
      return;
    }
    if (!m.groupSize || m.groupSize <= 1) return;
    if (!window.confirm(t('confirmDetachPhoto') || 'Move this photo into its own separate post?')) return;

    const occ = items.find((o) => o.id === m.occId);
    if (!occ) return;
    const images = occ.imagesResized || [];
    const videosList = occ.videos || [];
    const isImage = m.idx < images.length;
    const detachedImage = isImage ? images[m.idx] : undefined;
    const detachedVideoUrl = isImage ? undefined : videosList[m.idx - images.length];

    const remainingImages = isImage ? images.filter((_, i) => i !== m.idx) : images;
    const remainingVideos = isImage ? videosList : videosList.filter((_, vi) => images.length + vi !== m.idx);

    const d = occ.date as any;
    const sec = d?._seconds ?? d?.seconds;
    const dateIso = (typeof sec === 'number' ? new Date(sec * 1000) : new Date(d)).toISOString();

    try {
      const createRes = await apiFetch<{ photo: { id: string; date: any } }>(ApiRoute.SITE_PHOTOS, {
        method: 'POST',
        body: {
          date: dateIso,
          images: detachedImage ? [detachedImage.original] : [],
          videos: detachedVideoUrl ? [detachedVideoUrl] : [],
          description: '',
          taggedMemberIds: [],
          locale: i18n.language,
        },
      });

      const removeRes = await apiFetch<{ success: boolean; deleted?: boolean }>(ApiRoute.SITE_PHOTO_BY_ID, {
        method: 'PUT',
        pathParams: { photoId: m.occId },
        body: {
          locale: i18n.language,
          imagesWithDimensions: remainingImages.map((img) => ({ url: img.original, width: img.width, height: img.height })),
          videos: remainingVideos,
        },
      });

      const newOccurrence: Occurrence = {
        id: createRes.photo.id,
        type: 'gallery',
        date: createRes.photo.date,
        createdBy: currentUserId,
        description: '',
        imagesResized: detachedImage
          ? [{ original: detachedImage.original, '400x400': detachedImage.original, '1200x1200': detachedImage.original, width: detachedImage.width, height: detachedImage.height }]
          : [],
        videos: detachedVideoUrl ? [detachedVideoUrl] : undefined,
      };

      setItems((prev) => {
        const withoutDetached = removeRes.deleted || (remainingImages.length === 0 && remainingVideos.length === 0)
          ? prev.filter((o) => o.id !== m.occId)
          : prev.map((o) => (o.id === m.occId ? { ...o, imagesResized: remainingImages, videos: remainingVideos } : o));
        const insertAt = withoutDetached.findIndex((o) => o.id === m.occId);
        const at = insertAt === -1 ? 0 : insertAt;
        return [...withoutDetached.slice(0, at), newOccurrence, ...withoutDetached.slice(at)];
      });
    } catch (e) {
      console.error('[photos] detach item failed', e);
    }
  }, [items, i18n.language, t, currentUserId]);

  const handleOccurrenceUpdated = (updated: OccurrenceForEdit) => {
    setItems((prev) => prev.map((occ) => (occ.id === updated.id ? { ...occ, ...updated } : occ)));
  };

  const handleGalleryPhotoUpdated = (updated: GalleryPhotoForEdit) => {
    if (updated.deleted) {
      setItems((prev) => prev.filter((item) => item.id !== updated.id));
    } else {
      setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, date: updated.date, description: updated.description } : item)));
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

  const jumpControl = (
    <div className="flex items-center gap-2 mb-4 max-w-6xl mx-auto px-4 pt-4">
      <label className="text-sm text-sage-600" htmlFor="photos-jump-month">
        {t('jumpToMonth') || 'Jump to'}
      </label>
      <input
        id="photos-jump-month"
        type="month"
        value={jumpMonth}
        onChange={(e) => handleJumpToMonth(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
      />
      {jumpMonth && (
        <button
          type="button"
          onClick={() => handleJumpToMonth('')}
          className="text-sm text-sage-600 hover:underline"
        >
          {t('showAllPhotos') || 'Show all'}
        </button>
      )}
    </div>
  );

  if (loading) return (
    <>
      {jumpControl}
      <div className="p-4"><I18nText k="loading" /></div>
    </>
  );
  if (error) return (
    <>
      {jumpControl}
      <div className="p-4"><I18nText k="somethingWentWrong" /></div>
    </>
  );

  if (!loading && items.length === 0) {
    return (
      <>
        {jumpControl}
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="max-w-md space-y-4">
            {jumpMonth ? (
              <p className="text-lg text-sage-600 font-medium">
                {t('noPicturesInMonth') || 'No photos in this month.'}
              </p>
            ) : (
              <>
                <p className="text-lg text-sage-600 font-medium">
                  {t('noPicturesYet')}
                </p>
                {!isReadOnly && (
                  <p className="text-sage-500">
                    {t('wouldYouLikeToPostFirst')}
                  </p>
                )}
              </>
            )}
            {!isReadOnly && (
              <button
                onClick={() => router.push('/app/photo/new')}
                className="mt-6 px-6 py-3 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
              >
                {t('uploadPhoto')}
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {jumpControl}
      <div className="p-4 max-w-6xl mx-auto">
        <ImageGrid
          items={gridItems}
          getMeta={getGridMeta}
          onToggle={handleGridToggle}
          onTitleClick={handleTitleClick}
          onDeleteItem={handleDeleteItem}
          onDetachItem={handleDetachItem}
          getLightboxLink={getLightboxLink}
          autoSlideshow={autoSlideshow}
          useJsMasonry
        />
        {loadingMore && (
          <div className="p-4 text-center text-gray-500">
            {t('loading')}...
          </div>
        )}
      </div>

      <AddFab onClick={() => router.push('/app/photo/new')} ariaLabel={t('uploadPhoto')} />

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
