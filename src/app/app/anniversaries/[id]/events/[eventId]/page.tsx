"use client";

import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useSiteStore } from '@/store/SiteStore';
import { useReadOnlyStore } from '@/store/ReadOnlyStore';
import { initFirebase, ensureFirebaseSignedIn, auth } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AddFab from '@/components/ui/AddFab';
import { useAddAction } from '@/hooks/useAddAction';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import styles from './page.module.css';
import ImageGrid, { LikeMeta } from '@/components/media/ImageGrid';
import mediaStyles from '@/components/media/MediaLayout.module.css';
import { useTranslation } from 'react-i18next';
import OccurrenceEditModal from '@/components/anniversaries/OccurrenceEditModal';
import DropboxImportModal from '@/components/dropbox/DropboxImportModal';
import type { ImageWithDimension } from '@/entities/ImageWithDimension';
import type { ImportSourceLink } from '@/entities/ImportSourceLink';

interface OccurrenceDoc {
  id: string;
  siteId: string;
  eventId: string;
  date: any;
  images?: string[];
}

interface EventDoc {
  id: string;
  name: string;
  imageUrl?: string;
}

export default function OccurrenceDetailsPage({ params: paramsPromise }: { params: Promise<{ id: string; eventId: string }> }) {
  const params = use(paramsPromise);
  const { t } = useTranslation();
  const siteId = useSiteStore((state) => state.siteInfo?.id);
  const isReadOnly = useReadOnlyStore((state) => state.isReadOnly);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [occ, setOcc] = useState<OccurrenceDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [likes, setLikes] = useState<Array<{ index: number; count: number; likedByMe: boolean }>>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDropboxImport, setShowDropboxImport] = useState(false);
  // Collect mode (famcircle#196, Agla: "click to enter collect mode; add image to
  // collection with one click on the image"). Collection is held as URLs, because that
  // is what the API removes by.
  const [collectMode, setCollectMode] = useState(false);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  // The image list as it was before the last removal, for Undo. Full-list replacement
  // restores the original ORDER too, which re-adding would not.
  const [undoImages, setUndoImages] = useState<string[] | null>(null);
  const [undoCount, setUndoCount] = useState(0);

  // Mobile's BottomTabBar "+" calls whatever action is registered here - without this,
  // the desktop-only AddFab below (hidden md:flex) left mobile's "+" doing nothing.
  useAddAction(() => {
    if (!event) return;
    setShowAdd(true);
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError('');
      if (!siteId) {
        setError('site');
        setLoading(false);
        return;
      }
      try {
        const ae = await apiFetch<{ event: { id: string; name: string } }>(
          ApiRoute.SITE_ANNIVERSARY_BY_ID,
          { pathParams: { anniversaryId: params.id } }
        );
        const bo = await apiFetch<{ event: { id: string; date: any } }>(
          ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID,
          { pathParams: { anniversaryId: params.id, eventId: params.eventId } }
        );
        if (!mounted) return;
        setEvent(ae.event as any);
        setOcc(bo.event as any);
      } catch (e) {
        console.error(e);
        if (mounted) setError('load');
        throw e;
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [params.id, params.eventId, siteId]);

  useEffect(() => {
    (async () => {
      if (!occ || !siteId) return;
      try {
        const data = await apiFetch<{ items: Array<{ index: number; count: number; likedByMe: boolean }> }>(
          ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES,
          { pathParams: { anniversaryId: params.id, eventId: params.eventId } }
        );
        setLikes(data.items || []);
      } catch (e) {
        console.error('[likes] fetch failed', e);
      }
    })();
  }, [occ?.id, params.eventId, params.id, siteId]);

  // The event's own chosen cover picture (event.imageUrl) belongs in the grid too, not
  // just as a separate no-occurrence-images fallback - it's a real photo of this event
  // the family deliberately picked, and dropping it here means it's invisible on the
  // one page dedicated to this occurrence (Agla, 2026-07-21).
  const occurrenceImages: string[] = Array.isArray((occ as any)?.imagesWithDimensions) && (occ as any).imagesWithDimensions.length > 0
    ? (occ as any).imagesWithDimensions.map((img: any) => img.url)
    : Array.isArray(occ?.images) ? (occ?.images as string[]) : [];
  const visibleImages = Array.from(new Set(event?.imageUrl ? [event.imageUrl, ...occurrenceImages] : occurrenceImages));


  if (loading) {
    return (
      <div className="p-4">
        <I18nText k="loading" />
      </div>
    );
  }
  if (error || !event || !occ) {
    return (
      <div className="p-4">
        <I18nText k="somethingWentWrong" />
      </div>
    );
  }

  const raw = occ.date as any;
  const d = raw?.toDate
    ? raw.toDate()
    : typeof raw?._seconds === 'number'
      ? new Date(raw._seconds * 1000)
      : typeof raw?.seconds === 'number'
        ? new Date(raw.seconds * 1000)
        : new Date(raw);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const dateText = `${dd}/${mm}/${yyyy}`;

  async function resizeToWebp(file: File, maxWidth = 1600, quality = 0.9): Promise<Blob> {
    const img = document.createElement('img');
    img.decoding = 'async';
    img.src = URL.createObjectURL(file);
    await img.decode();
    const ratio = img.width > 0 ? Math.min(1, maxWidth / img.width) : 1;
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/webp', quality)
    );
    URL.revokeObjectURL(img.src);
    return blob;
  }

  async function onAddImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  function toggleCollected(url: string) {
    setCollected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  function exitCollectMode() {
    setCollectMode(false);
    setCollected(new Set());
  }

  async function refreshOccurrence() {
    const refreshed = await apiFetch<{ event: OccurrenceDoc }>(
      ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID,
      { pathParams: { anniversaryId: params.id, eventId: params.eventId } }
    );
    setOcc(refreshed.event as any);
  }

  async function removeCollected() {
    if (!occ || collected.size === 0) return;
    setRemoving(true);
    setUploadError('');
    const toRemove = Array.from(collected);
    // Snapshot BEFORE the write, so Undo restores exactly what was there.
    const before = occurrenceImages;
    try {
      await apiFetch(ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID, {
        method: 'PUT',
        pathParams: { anniversaryId: params.id, eventId: occ.id },
        body: { removeImages: toRemove },
      });
      await refreshOccurrence();
      setUndoImages(before);
      setUndoCount(toRemove.length);
      setCollected(new Set());
      setCollectMode(false);
    } catch (e) {
      console.error('[collect] remove failed:', e);
      setUploadError('remove');
    } finally {
      setRemoving(false);
    }
  }

  async function undoRemove() {
    if (!occ || !undoImages) return;
    setRemoving(true);
    try {
      // Full replacement, not re-add: this puts the photos back in their old positions.
      await apiFetch(ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID, {
        method: 'PUT',
        pathParams: { anniversaryId: params.id, eventId: occ.id },
        body: { images: undoImages },
      });
      await refreshOccurrence();
      setUndoImages(null);
      setUndoCount(0);
    } catch (e) {
      console.error('[collect] undo failed:', e);
      setUploadError('remove');
    } finally {
      setRemoving(false);
    }
  }

  async function onUploadSelected() {
    if (!occ || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      initFirebase();
      await ensureFirebaseSignedIn();
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Not signed in to Firebase');
      const storage = getStorage();
      const uploads = await Promise.all(
        selectedFiles.map(async (file, idx) => {
          const blob = await resizeToWebp(file, 1600, 0.9);
          const fileName = `${Date.now()}_${idx}.webp`;
          const path = `anniversaries/${currentUser.uid}/events/${occ.eventId}/${occ.id}/${fileName}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' });
          return await getDownloadURL(storageRef);
        })
      );
      await apiFetch(ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID, {
        method: 'PUT',
        pathParams: { anniversaryId: params.id, eventId: occ.id },
        body: { addImages: uploads },
      });
      // refresh
      const refreshed = await apiFetch<{ event: OccurrenceDoc }>(
        ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID,
        { pathParams: { anniversaryId: params.id, eventId: occ.id } }
      );
      setOcc(refreshed.event as any);
      try {
        const data = await apiFetch<{ items: Array<{ index: number; count: number; likedByMe: boolean }> }>(
          ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES,
          { pathParams: { anniversaryId: params.id, eventId: params.eventId } }
        );
        setLikes(data.items || []);
      } catch {}
      setShowAdd(false);
      setSelectedFiles([]);
      setPreviews([]);
    } catch (e) {
      console.error(e);
      setUploadError('upload');
      throw e;
    } finally {
      setUploading(false);
    }
  }

  

  function getLikeMeta(idx: number) {
    return likes.find((l) => l.index === idx) || { index: idx, count: 0, likedByMe: false };
  }

  async function toggleLike(idx: number) {
    const meta = getLikeMeta(idx);
    const next = { ...meta, likedByMe: !meta.likedByMe, count: meta.count + (meta.likedByMe ? -1 : 1) };
    setLikes((cur) => {
      const other = cur.filter((l) => l.index !== idx);
      return [...other, next].sort((a, b) => a.index - b.index);
    });
    try {
      const res = await apiFetch<{ index: number; count: number; likedByMe: boolean }>(
        ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES,
        {
          pathParams: { anniversaryId: params.id, eventId: params.eventId },
          method: 'POST',
          body: { imageIndex: idx, like: !meta.likedByMe },
        }
      );
      setLikes((cur) => {
        const other = cur.filter((l) => l.index !== idx);
        return [...other, res].sort((a, b) => a.index - b.index);
      });
    } catch (e) {
      console.error('[likes] toggle failed', e);
      // revert
      setLikes((cur) => {
        const other = cur.filter((l) => l.index !== idx);
        return [...other, meta].sort((a, b) => a.index - b.index);
      });
      throw e;
    }
  }


  return (
    <>
    <Card className={mediaStyles.container}>
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-700">
          {(occ as any)?.description && (
            <div className="mb-3 whitespace-pre-wrap text-gray-800">{(occ as any).description}</div>
          )}
          {/* Undo bar - a removal acts at once and is taken back here, instead of
              asking "are you sure" on every photo (famcircle#196). */}
          {undoImages && !collectMode && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded bg-gray-100 px-3 py-2 text-sm">
              <span>{t('photosRemoved', { count: undoCount })}</span>
              <button
                onClick={undoRemove}
                disabled={removing}
                className="font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                {t('undoRemove')}
              </button>
            </div>
          )}

          {/* COLLECT MODE: one click on a photo collects it. A plain grid on purpose -
              the lightbox, slideshow and masonry of ImageGrid all fight with a click
              that means "collect", so collecting gets its own simple surface. */}
          {collectMode && visibleImages.length > 0 && (
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCollected(new Set(visibleImages))}
                    className="text-blue-600 hover:underline"
                  >
                    {t('selectAll')}
                  </button>
                  <button
                    onClick={() => setCollected(new Set())}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                    disabled={collected.size === 0}
                  >
                    {t('clearCollection')}
                  </button>
                  <span className="text-gray-500">
                    {t('collectedCount', { count: collected.size })}
                  </span>
                </div>
                <Button
                  onClick={removeCollected}
                  disabled={collected.size === 0 || removing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {removing ? t('saving') : t('removeCollected', { count: collected.size })}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {visibleImages.map((src) => {
                  const isCollected = collected.has(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => toggleCollected(src)}
                      aria-pressed={isCollected}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                        isCollected ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                      {isCollected && (
                        <span className="absolute top-1 start-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                          &#10003;
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!collectMode && visibleImages.length > 0 && (
            <div className="mb-3">
              <ImageGrid
                items={visibleImages.map((src, i) => ({ key: `${occ.id}:${i}`, src }))}
                getMeta={(item) => {
                  const idx = Number(item.key.split(':')[1]);
                  const m = getLikeMeta(idx);
                  return { count: m.count, likedByMe: m.likedByMe } as LikeMeta;
                }}
                onToggle={(item) => {
                  const idx = Number(item.key.split(':')[1]);
                  return toggleLike(idx);
                }}
              />
            </div>
          )}
          {!occ.images?.length && (occ as any).imageUrl && (
            <img src={(occ as any).imageUrl} alt="" className="mb-3 max-h-72 w-full object-cover rounded" />
          )}
          {uploadError && <div className="text-red-600 mb-1"><I18nText k="somethingWentWrong" /></div>}
          <div className="mb-2"><span className="font-medium"><I18nText k="date" />:</span> {dateText}</div>
          {!isReadOnly && (
            <div className="mb-3 flex gap-2">
              <Button onClick={() => setShowEditModal(true)}>{t('edit')}</Button>
              <Button variant="outline" onClick={() => setShowDropboxImport(true)}>Import from Dropbox</Button>
              {visibleImages.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => (collectMode ? exitCollectMode() : setCollectMode(true))}
                >
                  {collectMode ? t('doneCollecting') : t('collectPhotos')}
                </Button>
              )}
            </div>
          )}
          <div>
            <a className="text-blue-600 hover:underline" href="/app/calendar">
              <I18nText k="familyCalendar" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
    <AddFab ariaLabel={t('add') as string} onClick={() => setShowAdd(true)} />

    <Modal isOpen={showAdd} onClose={() => setShowAdd(false)}>
      <div className="space-y-3 max-w-md">
        <div className={styles.dropzone}
             onClick={() => document.getElementById('occ-files')?.click()}
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files || []); const list = files.filter(f => f.type.startsWith('image/')); setSelectedFiles(list); setPreviews(list.map(f => URL.createObjectURL(f))); }}>
          {t('add')} {t('image')}
        </div>
        {previews.length > 0 && (
          <div className={styles.previewsGrid}>
            {previews.map((src, i) => (
              <img key={i} src={src} className={styles.previewImg} alt="" />
            ))}
          </div>
        )}
        <input id="occ-files" type="file" accept="image/*" multiple className="hidden" onChange={onAddImages} />
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setShowAdd(false)} className="bg-gray-200 text-gray-800 hover:bg-gray-300">{t('close')}</Button>
          <Button onClick={onUploadSelected} disabled={uploading || previews.length === 0}>{uploading ? t('saving') : t('save')}</Button>
        </div>
      </div>
    </Modal>

    <OccurrenceEditModal
      anniversaryId={params.id}
      occurrenceId={params.eventId}
      isOpen={showEditModal}
      onClose={() => setShowEditModal(false)}
      onUpdated={(updated) => {
        setOcc((prev) => ({ ...(prev as any), ...updated }));
      }}
      initialOccurrence={occ as any}
    />

    <DropboxImportModal
      isOpen={showDropboxImport}
      onClose={() => setShowDropboxImport(false)}
      previousLinks={(occ as any)?.importSources as ImportSourceLink[] | undefined}
      onImported={async () => {
        // Refresh occurrence data
        try {
          const refreshed = await apiFetch<{ event: OccurrenceDoc }>(
            ApiRoute.SITE_ANNIVERSARY_EVENT_BY_ID,
            { pathParams: { anniversaryId: params.id, eventId: params.eventId } }
          );
          setOcc(refreshed.event as any);
          const likesData = await apiFetch<{ items: Array<{ index: number; count: number; likedByMe: boolean }> }>(
            ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES,
            { pathParams: { anniversaryId: params.id, eventId: params.eventId } }
          );
          setLikes(likesData.items || []);
        } catch (e) {
          console.error('[dropbox] refresh failed', e);
        }
      }}
      target={{ anniversaryId: params.id, occurrenceId: params.eventId }}
    />

    {/* Lightbox handled by ImageGrid */}
    </>
  );
}
