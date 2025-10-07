"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import ImageGrid from '@/components/media/ImageGrid';
import layoutStyles from '@/components/media/MediaLayout.module.css';
import feedStyles from '@/components/media/ImageGrid.module.css';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useIsMobile } from '@/hooks/useIsMobile';
import { ShimmerImage } from "@/components/mobile/ShimmerImagePreview";
import md5 from 'blueimp-md5';
import OccurrenceEditModal, { OccurrenceForEdit } from '@/components/anniversaries/OccurrenceEditModal';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';

type Occurrence = {
  id: string; // occurrence id
  eventId: string; // anniversary id
  date: any;
  images?: string[];
  createdBy?: string;
};

type ImageLikeMeta = { index: number; count: number; likedByMe: boolean };
type AuthorInfo = { displayName: string; email: string };

export default function PicturesFeedPage() {
  const { t, i18n } = useTranslation();
  const user = useUserStore((state) => state.user);
  const memberRole = useMemberStore((state) => state.member?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Occurrence[]>([]);
  const [eventNames, setEventNames] = useState<Record<string, { name: string }>>({});
  const [likes, setLikes] = useState<Record<string, ImageLikeMeta[]>>({}); // key: occId
  const isMobile = useIsMobile();
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [editTarget, setEditTarget] = useState<{ annId: string; occId: string } | null>(null);
  const mountedRef = useRef(true);
  const currentUserId = user?.user_id ?? '';
  const isAdmin = memberRole === 'admin';
  const textDirection: 'ltr' | 'rtl' = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';

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

  const loadFeed = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current) return false;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{
        items: Occurrence[];
        events?: Record<string, { name: string }>;
        authors?: Record<string, { displayName: string; email: string }>;
      }>('/api/pictures', { cache: 'no-store' });
      if (!mountedRef.current) return false;
      const list: Occurrence[] = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setEventNames(data.events || {});
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
      setAuthors(normalizedAuthors);

      const likesMap: Record<string, ImageLikeMeta[]> = {};
      await Promise.all(
        list.map(async (occ) => {
          try {
            const likeResponse = await apiFetch<{ items: ImageLikeMeta[] }>(
              `/api/anniversaries/${occ.eventId}/events/${occ.id}/image-likes`,
              { cache: 'no-store' }
            );
            likesMap[occ.id] = Array.isArray(likeResponse.items) ? likeResponse.items : [];
          } catch (err) {
            console.error('[feed] like fetch failed', err);
          }
        })
      );
      if (!mountedRef.current) return true;
      setLikes(likesMap);
      return true;
    } catch (e) {
      console.error('[feed] load error', e);
      if (mountedRef.current) setError('load');
      return false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const feed = useMemo(() => {
    const flat: Array<{
      src: string;
      occId: string;
      annId: string;
      idx: number;
      key: string;
      title?: string;
      creatorId: string;
      dir: 'ltr' | 'rtl';
      canEdit: boolean;
    }> = [];
    for (const occ of items) {
      const arr = Array.isArray(occ.images) ? occ.images : [];
      arr.forEach((src, i) => {
        // Compute title only on first image per occurrence
        let title: string | undefined = undefined;
        if (i === 0) {
          const name = eventNames[occ.eventId]?.name || '';
          const d = occ.date as any;
          const sec = d?._seconds ?? d?.seconds;
          const js = typeof sec === 'number' ? new Date(sec * 1000) : (d?.toDate ? d.toDate() : new Date(d));
          const dateText = js instanceof Date && !isNaN(js.getTime()) ? js.toLocaleDateString() : '';
          if (name || dateText) title = [name, dateText].filter(Boolean).join(' — ');
        }
        const creatorId = occ.createdBy;
        if (!creatorId) {
          throw new Error(`[PicturesFeedPage] missing creatorId for occurrence ${occ.id}`);
        }
        const canEdit = canEditOccurrence(creatorId);
        flat.push({
          src,
          occId: occ.id,
          annId: occ.eventId,
          idx: i,
          key: `${occ.id}:${i}`,
          title,
          creatorId,
          dir: textDirection,
          canEdit,
        });
      });
    }
    return flat;
  }, [items, eventNames, textDirection, canEditOccurrence]);

  function getLikeMeta(occId: string, idx: number): ImageLikeMeta {
    const arr = likes[occId] || [];
    return arr.find((l) => l.index === idx) || { index: idx, count: 0, likedByMe: false };
  }

  const openOccurrenceModal = (annId: string, occId: string, creatorId?: string) => {
    if (!canEditOccurrence(creatorId)) return;
    setEditTarget({ annId, occId });
  };

  const handleOccurrenceUpdated = (updated: OccurrenceForEdit) => {
    setItems((prev) => prev.map((occ) => (occ.id === updated.id ? { ...occ, ...updated } : occ)));
  };

  const currentOccurrence = useMemo(() => {
    if (!editTarget) return null;
    return items.find((occ) => occ.id === editTarget.occId) ?? null;
  }, [editTarget, items]);

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

  async function toggleLike(annId: string, occId: string, idx: number) {
    const meta = getLikeMeta(occId, idx);
    const next = { ...meta, likedByMe: !meta.likedByMe, count: meta.count + (meta.likedByMe ? -1 : 1) };
    setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), next].sort((a, b) => a.index - b.index) }));
    try {
      const data = await apiFetch<{ index: number; count: number; likedByMe: boolean }>(
        `/api/anniversaries/${annId}/events/${occId}/image-likes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIndex: idx, like: !meta.likedByMe }),
        }
      );
      setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), data].sort((a, b) => a.index - b.index) }));
    } catch (e) {
      console.error('[feed] like toggle failed', e);
      // revert
      setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), meta].sort((a, b) => a.index - b.index) }));
    }
  }

  if (loading) return <div className="p-4"><I18nText k="loading" /></div>;
  if (error) return <div className="p-4"><I18nText k="somethingWentWrong" /></div>;

  if (isMobile) {
    return (
      <>
        <div className={feedStyles.mobileContinuousContainer}>
          <div className={feedStyles.mobileContinuousList}>
          {feed.map((item) => {
            const meta = getLikeMeta(item.occId, item.idx);
            const author = authors[item.creatorId];
            if (!author) {
              throw new Error(`[PicturesFeedPage] missing author data for creator ${item.creatorId}`);
            }
            return (
              <MobileFeedItem
                key={item.key}
                item={item}
                title={item.title}
                meta={meta}
                author={author}
                onToggle={() => toggleLike(item.annId, item.occId, item.idx)}
                t={t}
                onTitleClick={item.title && item.canEdit ? () => openOccurrenceModal(item.annId, item.occId, item.creatorId) : undefined}
                canEdit={item.canEdit}
                titleDir={item.dir}
              />
            );
          })}
          </div>
        </div>
        {occurrenceModal}
      </>
    );
  }

  return (
    <>
      <Card className={layoutStyles.container}>
        <CardHeader>
          <CardTitle>Pictures Feed</CardTitle>
        </CardHeader>
      <CardContent>
        <ImageGrid
          items={feed.map((f) => ({
            key: f.key,
            src: f.src,
            title: f.title,
            dir: f.dir,
            meta: { annId: f.annId, occId: f.occId, creatorId: f.creatorId, canEdit: f.canEdit },
          }))}
          getMeta={(item) => {
            const f = feed.find((x) => x.key === item.key)!;
            return getLikeMeta(f.occId, f.idx);
          }}
          onToggle={(item) => {
            const f = feed.find((x) => x.key === item.key)!;
            return toggleLike(f.annId, f.occId, f.idx);
          }}
          onTitleClick={(item) => {
            const meta = (item.meta || {}) as { annId?: string; occId?: string; creatorId?: string; canEdit?: boolean };
            if (!meta.canEdit) return;
            if (!meta.annId || !meta.occId) return;
            openOccurrenceModal(meta.annId, meta.occId, meta.creatorId);
          }}
        />
      </CardContent>

        {/* Lightbox handled inside ImageGrid */}
      </Card>
      {occurrenceModal}
    </>
  );
}

interface MobileFeedItemProps {
  item: {
    key: string;
    src: string;
    title?: string;
    creatorId: string;
  } & { occId: string; annId: string; idx: number };
  title?: string;
  meta: ImageLikeMeta;
  author: AuthorInfo;
  onToggle: () => Promise<void> | void;
  t: TFunction;
  onTitleClick?: () => void;
  canEdit: boolean;
  titleDir: 'ltr' | 'rtl';
}

function MobileFeedItem({ item, title, meta, author, onToggle, t, onTitleClick, canEdit, titleDir }: MobileFeedItemProps) {
  const [loaded, setLoaded] = useState(false);
  const wrapperClass = feedStyles.mobileContinuousImageWrap;
  const likeClass =
    feedStyles.mobileContinuousLike +
    (meta.likedByMe ? ' ' + feedStyles.mobileContinuousLikeActive : '');

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
      <div className={feedStyles.mobileMetaRow}>
        <div className={feedStyles.mobileAuthorAvatar}>
          <img src={avatarUrl} alt="" className={feedStyles.mobileAuthorAvatarImage} />
        </div>
        <div className={feedStyles.mobileAuthorInfo}>
          <span className={feedStyles.mobileAuthorName}>
            {author.displayName}
          </span>
        </div>
      </div>
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
      />
      {loaded ? (
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
      ) : (
        <div className={feedStyles.mobileContinuousLikePlaceholder} aria-hidden="true" />
      )}
    </article>
  );
}
