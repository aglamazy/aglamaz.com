"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import ImageGrid from '@/components/media/ImageGrid';
import mediaStyles from '@/components/media/MediaLayout.module.css';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useIsMobile } from '@/hooks/useIsMobile';
import { ShimmerImage } from "@/components/mobile/ShimmerImagePreview";

type Occurrence = {
  id: string; // occurrence id
  eventId: string; // anniversary id
  date: any;
  images?: string[];
};

type ImageLikeMeta = { index: number; count: number; likedByMe: boolean };

export default function PicturesFeedPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Occurrence[]>([]);
  const [eventNames, setEventNames] = useState<Record<string, { name: string }>>({});
  const [likes, setLikes] = useState<Record<string, ImageLikeMeta[]>>({}); // key: occId
  const isMobile = useIsMobile();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/pictures', { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch');
        const data = await res.json();
        if (!mounted) return;
        const list: Occurrence[] = Array.isArray(data.items) ? data.items : [];
        setItems(list);
        setEventNames(data.events || {});
        // fetch likes per occurrence
        await Promise.all(
          list.map(async (occ) => {
            try {
              const r = await fetch(`/api/anniversaries/${occ.eventId}/events/${occ.id}/image-likes`, { cache: 'no-store' });
              if (!r.ok) return;
              const d = await r.json();
              if (!mounted) return;
              setLikes((cur) => ({ ...cur, [occ.id]: d.items || [] }));
            } catch {}
          })
        );
      } catch (e) {
        console.error('[feed] load error', e);
        if (mounted) setError('load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const feed = useMemo(() => {
    const flat: Array<{ src: string; occId: string; annId: string; idx: number; key: string; title?: string }> = [];
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
        flat.push({ src, occId: occ.id, annId: occ.eventId, idx: i, key: `${occ.id}:${i}`, title });
      });
    }
    return flat;
  }, [items]);

  function getLikeMeta(occId: string, idx: number): ImageLikeMeta {
    const arr = likes[occId] || [];
    return arr.find((l) => l.index === idx) || { index: idx, count: 0, likedByMe: false };
  }

  async function toggleLike(annId: string, occId: string, idx: number) {
    const meta = getLikeMeta(occId, idx);
    const next = { ...meta, likedByMe: !meta.likedByMe, count: meta.count + (meta.likedByMe ? -1 : 1) };
    setLikes((cur) => ({ ...cur, [occId]: [...(cur[occId] || []).filter((l) => l.index !== idx), next].sort((a, b) => a.index - b.index) }));
    try {
      const res = await fetch(`/api/anniversaries/${annId}/events/${occId}/image-likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIndex: idx, like: !meta.likedByMe }),
      });
      if (!res.ok) throw new Error('like');
      const data = await res.json();
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
      <div className={mediaStyles.mobileContinuousContainer}>
        <div className={mediaStyles.mobileContinuousHeader}>
          <h2>{t('photoFeed', { defaultValue: 'Photo Feed' }) as string}</h2>
          <p>{t('photoFeedSwipeHint', { defaultValue: 'Scroll to browse the latest photos' }) as string}</p>
        </div>
        <div className={mediaStyles.mobileContinuousList}>
          {feed.map((item) => {
            const meta = getLikeMeta(item.occId, item.idx);
            return (
              <MobileFeedItem
                key={item.key}
                item={item}
                title={item.title}
                meta={meta}
                onToggle={() => toggleLike(item.annId, item.occId, item.idx)}
                t={t}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className={mediaStyles.container}>
      <CardHeader>
        <CardTitle>Pictures Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <ImageGrid
          items={feed.map((f) => ({ key: f.key, src: f.src, title: f.title }))}
          getMeta={(item) => {
            const f = feed.find((x) => x.key === item.key)!;
            return getLikeMeta(f.occId, f.idx);
          }}
          onToggle={(item) => {
            const f = feed.find((x) => x.key === item.key)!;
            return toggleLike(f.annId, f.occId, f.idx);
          }}
        />
      </CardContent>

      {/* Lightbox handled inside ImageGrid */}
    </Card>
  );
}

interface MobileFeedItemProps {
  item: {
    key: string;
    src: string;
    title?: string;
  } & { occId: string; annId: string; idx: number };
  title?: string;
  meta: ImageLikeMeta;
  onToggle: () => Promise<void> | void;
  t: TFunction;
}

function MobileFeedItem({ item, title, meta, onToggle, t }: MobileFeedItemProps) {
  const [loaded, setLoaded] = useState(false);
  const wrapperClass = mediaStyles.mobileContinuousImageWrap;
  const likeClass =
    mediaStyles.mobileContinuousLike +
    (meta.likedByMe ? ' ' + mediaStyles.mobileContinuousLikeActive : '');

  return (
    <article className={mediaStyles.mobileContinuousItem}>
      {title ? <div className={mediaStyles.mobileContinuousTitle}>{title}</div> : null}
      <ShimmerImage
        src={item.src}
        alt={title || ''}
        useDefaultStyles={false}
        wrapperClassName={wrapperClass}
        imageClassName={mediaStyles.mobileContinuousImage}
        loadingClassName={mediaStyles.mobileContinuousImageWrapLoading}
        hiddenClassName={mediaStyles.mobileContinuousImageHidden}
        visibleClassName={mediaStyles.mobileContinuousImageVisible}
        shimmerClassName={mediaStyles.mobileShimmer}
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
        <div className={mediaStyles.mobileContinuousLikePlaceholder} aria-hidden="true" />
      )}
    </article>
  );
}
