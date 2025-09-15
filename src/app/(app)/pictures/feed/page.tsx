"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import ImageGrid from '@/components/media/ImageGrid';
import mediaStyles from '@/components/media/MediaLayout.module.css';
import { useTranslation } from 'react-i18next';

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
  const [likes, setLikes] = useState<Record<string, ImageLikeMeta[]>>({}); // key: occId

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
    const flat: Array<{ src: string; occId: string; annId: string; idx: number; key: string }> = [];
    for (const occ of items) {
      const arr = Array.isArray(occ.images) ? occ.images : [];
      arr.forEach((src, i) => flat.push({ src, occId: occ.id, annId: occ.eventId, idx: i, key: `${occ.id}:${i}` }));
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

  return (
    <Card className={mediaStyles.container}>
      <CardHeader>
        <CardTitle>Pictures Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <ImageGrid
          items={feed.map((f) => ({ key: f.key, src: f.src }))}
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
