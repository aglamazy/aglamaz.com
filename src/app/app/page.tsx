"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import ImageGrid from '@/components/media/ImageGrid';
import layoutStyles from '@/components/media/MediaLayout.module.css';
import feedStyles from '@/components/media/ImageGrid.module.css';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ShimmerImage } from "@/components/mobile/ShimmerImagePreview";
import md5 from 'blueimp-md5';
import type { ImageWithDimension } from '@/entities/ImageWithDimension';
import { MoreVertical } from 'lucide-react';
import OccurrenceEditModal, { OccurrenceForEdit } from '@/components/anniversaries/OccurrenceEditModal';
import GalleryPhotoEditModal, { GalleryPhotoForEdit } from '@/components/photos/GalleryPhotoEditModal';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { formatLocalizedDate } from '@/utils/dateFormat';
import WelcomeHero from '@/components/home/WelcomeHero';
import { getPlatformName } from '@/utils/platformName';
import AvatarStack from '@/components/photos/AvatarStack';
import LikersBottomSheet from '@/components/photos/LikersBottomSheet';
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
  id: string; // occurrence/gallery photo id
  type?: 'occurrence' | 'gallery'; // added by API
  eventId?: string; // anniversary id (for occurrences)
  anniversaryId?: string; // anniversary id (for gallery photos)
  date: any;
  imagesResized?: ImageSizes[]; // Images with multiple sizes and dimensions from API
  createdBy?: string;
  description?: string;
};

type AuthorInfo = { displayName: string; email: string };

export default function PicturesFeedPage() {
  const { t, i18n} = useTranslation();
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
  const [likes, setLikes] = useState<Record<string, ImageLikeMeta[]>>({}); // key: occId
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [editTarget, setEditTarget] = useState<{ annId: string; occId: string } | null>(null);
  const [galleryEditTarget, setGalleryEditTarget] = useState<string | null>(null);
  const [likersSheet, setLikersSheet] = useState<{ occId: string; imageIndex: number } | null>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const mountedRef = useRef(true);
  const currentUserId = user?.user_id ?? '';
  const isAdmin = memberRole === 'admin';
  const textDirection: 'ltr' | 'rtl' = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';

  const ITEMS_PER_PAGE = 10;

  // Register add action - navigate to photo upload page
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

      // Check if there are more items to load
      setHasMore(list.length === ITEMS_PER_PAGE);

      // Append items for pagination, replace for initial load
      if (isInitialLoad) {
        setItems(list);
      } else {
        setItems(prev => [...prev, ...list]);
      }

      // Merge event names and authors
      setEventNames(prev => ({ ...prev, ...(data.events || {}) }));

      const rawAuthors = data.authors;
      if (!rawAuthors || typeof rawAuthors !== 'object') {
        throw new Error('[PicturesFeedPage] authors payload missing');
      }
      const normalizedAuthors: Record<string, AuthorInfo> = {};
      for (const [id, info] of Object.entries(rawAuthors)) {
        if (!info || typeof info !== 'object') {
          throw new Error(`[PicturesFeedPage] invalid author payload for ${id}`);
        }
        const displayName = (info as any).displayName?.trim();
        const email = (info as any).email?.trim();
        if (!displayName || !email) {
          throw new Error(`[PicturesFeedPage] incomplete author data for ${id}`);
        }
        normalizedAuthors[id] = { displayName, email };
      }
      if (!mountedRef.current) return true;
      setAuthors(prev => ({ ...prev, ...normalizedAuthors }));

      const likesMap: Record<string, ImageLikeMeta[]> = {};
      await Promise.all(
        list.map(async (occ) => {
          try {
            // Use different endpoints for occurrence vs gallery photos
            const likeResponse = occ.type === 'gallery'
              ? await apiFetch<{ items: ImageLikeMeta[] }>(ApiRoute.SITE_PHOTO_IMAGE_LIKES, {
                  pathParams: { photoId: occ.id },
                })
              : await apiFetch<{ items: ImageLikeMeta[] }>(ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES, {
                  pathParams: { anniversaryId: occ.eventId!, eventId: occ.id },
                });

            likesMap[occ.id] = Array.isArray(likeResponse.items) ? likeResponse.items : [];
          } catch (err) {
            console.error('[feed] like fetch failed', err);
          }
        })
      );
      if (!mountedRef.current) return true;
      setLikes(prev => ({ ...prev, ...likesMap }));
      return true;
    } catch (e) {
      console.error('[feed] load error', e);
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
      // Trigger lazy loading of 3rd+ images on first scroll
      if (!userHasScrolled) {
        setUserHasScrolled(true);
      }

      if (loadingMore || !hasMore) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      // Trigger load more when user is within 500px of bottom
      if (scrollHeight - scrollTop - clientHeight < 500) {
        void loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, hasMore, userHasScrolled]);

  const feed = useMemo(() => {
    const flat: Array<{
      src: string;
      srcMobile: string;
      srcDesktopGrid: string;
      srcDesktopLightbox: string;
      occId: string;
      annId: string;
      idx: number;
      key: string;
      creatorId: string;
      dir: 'ltr' | 'rtl';
      canEdit: boolean;
      eventName: string;
      occDescription: string;
      dateText: string;
      showHeader: boolean;
      type?: 'occurrence' | 'gallery';
      globalImageIndex: number;
      width?: number;
      height?: number;
    }> = [];
    let globalImageIndex = 0;
    for (const occ of items) {
      // Note: "occurrence" is called "event" in the code (anniversary event)
      const eventImages = occ.imagesResized || [];
      const occDescriptionRaw = typeof occ.description === 'string' ? occ.description : '';
      const occDescription = occDescriptionRaw.trim();
      // Handle both occurrence (eventId) and gallery (anniversaryId)
      const annId = occ.eventId || occ.anniversaryId || '';
      const eventNameRaw = eventNames[annId]?.name;
      const eventName = typeof eventNameRaw === 'string' ? eventNameRaw.trim() : '';
      const d = occ.date as any;
      const sec = d?._seconds ?? d?.seconds;
      const js = typeof sec === 'number' ? new Date(sec * 1000) : (d?.toDate ? d.toDate() : new Date(d));
      const dateText = formatLocalizedDate(js, i18n.language);

      eventImages.forEach((image, i) => {
        const creatorId = occ.createdBy;
        if (!creatorId) {
          throw new Error(`[PicturesFeedPage] missing creatorId for ${occ.type || 'item'} ${occ.id}`);
        }
        // Allow edit for both occurrences and gallery photos (if user is creator or admin)
        const canEdit = canEditOccurrence(creatorId);

        // Extract different sizes for different contexts
        const src = image.original;
        const srcMobile = image['800x800'] || src;
        const srcDesktopGrid = image['400x400'] || src;
        const srcDesktopLightbox = image['1200x1200'] || src;

        flat.push({
          src,
          srcMobile,
          srcDesktopGrid,
          srcDesktopLightbox,
          occId: occ.id,
          annId,
          idx: i,
          key: `${occ.id}:${i}`,
          creatorId,
          dir: textDirection,
          canEdit,
          eventName,
          occDescription,
          dateText,
          showHeader: i === 0,
          type: occ.type,
          globalImageIndex: globalImageIndex++,
          width: image.width,
          height: image.height,
        });
      });
    }
    return flat;
  }, [items, eventNames, textDirection, canEditOccurrence]);

  function getLikeMeta(occId: string, idx: number): ImageLikeMeta {
    const arr = likes[occId] || [];
    return arr.find((l) => l.index === idx) || { index: idx, count: 0, likedByMe: false, likers: [] };
  }

  const openOccurrenceModal = (annId: string, occId: string, creatorId?: string) => {
    if (!canEditOccurrence(creatorId)) return;
    setEditTarget({ annId, occId });
  };

  const handleOccurrenceUpdated = (updated: OccurrenceForEdit) => {
    setItems((prev) => prev.map((occ) => (occ.id === updated.id ? { ...occ, ...updated } : occ)));
  };

  const handleGalleryPhotoUpdated = (updated: GalleryPhotoForEdit) => {
    if (updated.images.length === 0) {
      // Photo was deleted - remove from items
      setItems((prev) => prev.filter((item) => item.id !== updated.id));
    } else {
      // Photo was updated
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

  const occurrenceModal = editTarget && currentOccurrence && canEditCurrent ? (
    <OccurrenceEditModal
      anniversaryId={editTarget.annId}
      occurrenceId={editTarget.occId}
      isOpen={true}
      onClose={() => setEditTarget(null)}
      onUpdated={handleOccurrenceUpdated}
      initialOccurrence={currentOccurrence as OccurrenceForEdit | null}
    />
  ) : null;

  const galleryPhotoModal = galleryEditTarget && currentGalleryPhoto ? (
    <GalleryPhotoEditModal
      photoId={galleryEditTarget}
      isOpen={true}
      onClose={() => setGalleryEditTarget(null)}
      onUpdated={handleGalleryPhotoUpdated}
      initialPhoto={currentGalleryPhoto as GalleryPhotoForEdit | null}
    />
  ) : null;

  const currentLikersData = useMemo(() => {
    if (!likersSheet) return null;
    return getLikeMeta(likersSheet.occId, likersSheet.imageIndex);
  }, [likersSheet, likes]);

  async function toggleLike(annId: string, occId: string, idx: number, type?: 'occurrence' | 'gallery') {
    const meta = getLikeMeta(occId, idx);
    const next: ImageLikeMeta = { ...meta, likedByMe: !meta.likedByMe, count: meta.count + (meta.likedByMe ? -1 : 1) };
    setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), next].sort((a, b) => a.index - b.index) }));
    try {
      // Use different endpoints for occurrence vs gallery photos
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

      // Update with full response including refreshed likers array
      setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), data].sort((a, b) => a.index - b.index) }));
    } catch (e) {
      console.error('[feed] like toggle failed', e);
      // revert
      setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), meta].sort((a, b) => a.index - b.index) }));
    }
  }

  if (loading) return <div className="p-4"><I18nText k="loading" /></div>;
  if (error) return <div className="p-4"><I18nText k="somethingWentWrong" /></div>;

  // Empty state when no pictures
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

  // Desktop welcome hero
  const siteDisplayName = site?.name?.trim() || getPlatformName(site);
  const heroTitle = t('welcomeToSite', { name: siteDisplayName }) as string;
  const aboutFamily = site?.aboutFamily;

  // Preload first image for faster LCP
  const firstImageSrc = feed.length > 0 ? feed[0].src : null;

  return (
    <>
      {/* Preload first image for faster LCP */}
      {firstImageSrc && (
        <link rel="preload" as="image" href={firstImageSrc} />
      )}

      {/* Desktop WelcomeHero - hidden on mobile */}
      {aboutFamily && (
        <div className="desktop-only">
          <WelcomeHero user={user} title={heroTitle} aboutFamily={aboutFamily} />
        </div>
      )}

      {/* Mobile version - hidden on desktop */}
      <div className="mobile-only">
        <div className={feedStyles.mobileContinuousContainer}>
          <div className={feedStyles.mobileContinuousList}>
          {feed.map((item) => {
            const meta = getLikeMeta(item.occId, item.idx);
            const author = authors[item.creatorId];
            if (!author) {
              throw new Error(`[PicturesFeedPage] missing author data for creator ${item.creatorId}`);
            }
            const baseLabel = item.occDescription || item.eventName;
            const headerText = item.showHeader ? [baseLabel, item.dateText].filter(Boolean).join(' — ') : undefined;

            // Image loading strategy: first 3 load eagerly (to fill viewport), rest lazy load
            // First image gets high priority for fastest LCP
            const imageLoading: 'eager' | 'lazy' = item.globalImageIndex < 3 ? 'eager' : 'lazy';
            const imagePriority: 'high' | 'low' | 'auto' = item.globalImageIndex === 0 ? 'high' : 'auto';

            return (
              <MobileFeedItem
                key={item.key}
                item={{ ...item, src: item.srcMobile }}
                title={headerText}
                meta={meta}
                author={author}
                onToggle={() => toggleLike(item.annId, item.occId, item.idx, item.type)}
                onShowLikers={() => setLikersSheet({ occId: item.occId, imageIndex: item.idx })}
                t={t}
                onTitleClick={headerText && item.canEdit ? () => openOccurrenceModal(item.annId, item.occId, item.creatorId) : undefined}
                canEdit={item.canEdit}
                titleDir={item.dir}
                onGalleryEdit={(photoId) => setGalleryEditTarget(photoId)}
                imageLoading={imageLoading}
                imagePriority={imagePriority}
                imageWidth={item.width}
                imageHeight={item.height}
              />
            );
          })}
          {loadingMore && (
            <div className="p-4 text-center text-gray-500">
              {t('loading')}...
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Desktop version - hidden on mobile */}
      <Card className={`${layoutStyles.container} desktop-only`}>
        <CardHeader>
          <CardTitle>{t('picturesFeed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageGrid
            items={feed.map((f) => {
              const baseLabel = f.occDescription || f.eventName;
              const title = f.showHeader ? [baseLabel, f.dateText].filter(Boolean).join(' — ') : undefined;
              // Desktop grid uses 400x400 thumbnails, lightbox will use 1200x1200
              return {
                key: f.key,
                src: f.srcDesktopGrid,
                lightboxSrc: f.srcDesktopLightbox,
                title,
                dir: f.dir,
                meta: { annId: f.annId, occId: f.occId, creatorId: f.creatorId, canEdit: f.canEdit },
              };
            })}
            getMeta={(item) => {
              const f = feed.find((x) => x.key === item.key)!;
              return getLikeMeta(f.occId, f.idx);
            }}
            onToggle={(item) => {
              const f = feed.find((x) => x.key === item.key)!;
              return toggleLike(f.annId, f.occId, f.idx, f.type);
            }}
            onTitleClick={(item) => {
              const meta = (item.meta || {}) as { annId?: string; occId?: string; creatorId?: string; canEdit?: boolean };
              if (!meta.canEdit) return;
              if (!meta.annId || !meta.occId) return;
              openOccurrenceModal(meta.annId, meta.occId, meta.creatorId);
            }}
          />
          {loadingMore && (
            <div className="p-4 text-center text-gray-500">
              {t('loading')}...
            </div>
          )}
        </CardContent>

        {/* Lightbox handled inside ImageGrid */}
      </Card>

      {occurrenceModal}
      {galleryPhotoModal}
      {likersSheet && currentLikersData && (
        <LikersBottomSheet
          open={true}
          likers={currentLikersData.likers}
          onClose={() => setLikersSheet(null)}
          title={t('whoLiked') as string || 'Who liked this'}
          emptyLabel={t('noLikes') as string || 'No likes yet'}
          dir={textDirection}
          language={i18n.language}
        />
      )}
    </>
  );
}

interface MobileFeedItemProps {
  item: {
    key: string;
    src: string;
    creatorId: string;
    occDescription: string;
    eventName: string;
    dateText: string;
    showHeader: boolean;
    type?: 'occurrence' | 'gallery';
  } & { occId: string; annId: string; idx: number };
  title?: string;
  meta: ImageLikeMeta;
  author: AuthorInfo;
  onToggle: () => Promise<void> | void;
  onShowLikers: () => void;
  t: TFunction;
  onTitleClick?: () => void;
  canEdit: boolean;
  titleDir: 'ltr' | 'rtl';
  onGalleryEdit?: (photoId: string) => void;
  imageLoading?: 'eager' | 'lazy';
  imagePriority?: 'high' | 'low' | 'auto';
  imageWidth?: number;
  imageHeight?: number;
}

function MobileFeedItem({ item, title, meta, author, onToggle, onShowLikers, t, onTitleClick, canEdit, titleDir, onGalleryEdit, imageLoading = 'eager', imagePriority = 'auto', imageWidth, imageHeight }: MobileFeedItemProps) {
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperClass = feedStyles.mobileContinuousImageWrap;
  const isRtl = titleDir === 'rtl';
  const isGallery = item.type === 'gallery';

  const metaRowClass = feedStyles.mobileMetaRow + (isRtl ? ' ' + feedStyles.mobileMetaRowRtl : '');
  const likeClass =
    feedStyles.mobileContinuousLike +
    (isRtl ? ' ' + feedStyles.mobileContinuousLikeRtl : '') +
    (meta.likedByMe ? ' ' + feedStyles.mobileContinuousLikeActive : '');
  const likePlaceholderClass =
    feedStyles.mobileContinuousLikePlaceholder +
    (isRtl ? ' ' + feedStyles.mobileContinuousLikePlaceholderRtl : '');

  const avatarUrl = useMemo(() => {
    const email = author.email.trim().toLowerCase();
    return `https://www.gravatar.com/avatar/${md5(email)}?s=64&d=identicon`;
  }, [author.email]);

  return (
    <article className={feedStyles.mobileContinuousItem}>
      {title ? (
        canEdit && onTitleClick ? (
          <button
            type="button"
            className={feedStyles.mobileEventHeader + ' ' + feedStyles.mobileEventHeaderButton}
            onClick={onTitleClick}
            dir={titleDir}
          >
            {title}
          </button>
        ) : (
          <div className={feedStyles.mobileEventHeader} dir={titleDir}>{title}</div>
        )
      ) : null}
      <div style={{ position: 'relative' }}>
        <ShimmerImage
          src={item.src}
          alt={title || ''}
          useDefaultStyles={false}
          wrapperClassName={wrapperClass}
          imageClassName={feedStyles.mobileContinuousImage}
          loadingClassName={feedStyles.mobileContinuousImageWrapLoading}
          hiddenClassName={feedStyles.mobileContinuousImageHidden}
          visibleClassName={feedStyles.mobileContinuousImageVisible}
          shimmerClassName={feedStyles.mobileShimmer}
          onLoadStateChange={setLoaded}
          loading={imageLoading}
          fetchPriority={imagePriority}
          width={imageWidth}
          height={imageHeight}
        />
        <div className={metaRowClass}>
          <div className={feedStyles.mobileAuthorAvatar}>
            <img src={avatarUrl} alt="" className={feedStyles.mobileAuthorAvatarImage} />
          </div>
          <div className={feedStyles.mobileAuthorInfo}>
            <span className={feedStyles.mobileAuthorName}>
              {author.displayName}
            </span>
          </div>
        </div>
        {isGallery && canEdit && onGalleryEdit && (
          <div className={feedStyles.mobilePhotoMenu + (isRtl ? ' ' + feedStyles.mobilePhotoMenuRtl : '')}>
            <button
              type="button"
              className={feedStyles.mobilePhotoMenuButton}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className={feedStyles.mobilePhotoMenuDropdown + (isRtl ? ' ' + feedStyles.mobilePhotoMenuDropdownRtl : '')}>
                <button
                  type="button"
                  className={feedStyles.mobilePhotoMenuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    onGalleryEdit(item.occId);
                  }}
                >
                  {t('edit') || 'Edit'}
                </button>
              </div>
            )}
          </div>
        )}
        {loaded ? (
          <>
            <button
              type="button"
              className={likeClass}
              onClick={() => {
                void onToggle();
              }}
              aria-label={meta.likedByMe ? (t('unlike') as string) : (t('like') as string)}
            >
              <span>❤</span>
              <span>{meta.count}</span>
            </button>
            {meta.count > 0 && (
              <div
                onClick={onShowLikers}
                style={{
                  position: 'absolute',
                  bottom: '0.75rem',
                  insetInlineEnd: '78px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '0.35rem 0.8rem',
                }}
              >
                <AvatarStack
                  likers={meta.likers}
                  maxVisible={3}
                  size={28}
                  direction={isRtl ? 'rtl' : 'ltr'}
                />
              </div>
            )}
          </>
        ) : (
          <div className={likePlaceholderClass} aria-hidden="true" />
        )}
      </div>
    </article>
  );
}
