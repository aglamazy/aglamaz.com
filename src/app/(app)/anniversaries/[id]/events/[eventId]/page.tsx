"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import { apiFetch } from '@/utils/apiFetch';
import { initFirebase, ensureFirebaseSignedIn, auth } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AddFab from '@/components/ui/AddFab';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import styles from './page.module.css';
import { useTranslation } from 'react-i18next';

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
}

export default function OccurrenceDetailsPage({ params }: { params: { id: string; eventId: string } }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [occ, setOcc] = useState<OccurrenceDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const ae = await apiFetch<{ event: { id: string; name: string } }>(
          `/api/anniversaries/${params.id}`
        );
        const bo = await apiFetch<{ event: { id: string; date: any } }>(
          `/api/anniversaries/${params.id}/events/${params.eventId}`
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
  }, [params.id, params.eventId]);

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
      await apiFetch(`/api/anniversaries/${occ.eventId}/events/${occ.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addImages: uploads }),
      });
      // refresh
      const refreshed = await apiFetch<{ event: OccurrenceDoc }>(
        `/api/anniversaries/${occ.eventId}/events/${occ.id}`
      );
      setOcc(refreshed.event as any);
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

  return (
    <>
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-700">
          {Array.isArray(occ.images) && occ.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {occ.images.map((src) => (
                <img key={src} src={src} alt="" className="w-full max-h-60 object-cover rounded" />
              ))}
            </div>
          )}
          {!occ.images?.length && (occ as any).imageUrl && (
            <img src={(occ as any).imageUrl} alt="" className="mb-3 max-h-72 w-full object-cover rounded" />
          )}
          {uploadError && <div className="text-red-600 mb-1"><I18nText k="somethingWentWrong" /></div>}
          <div className="mb-2">
            <span className="font-medium"><I18nText k="date" />:</span> {dateText}
          </div>
          <div>
            <a className="text-blue-600 hover:underline" href="/calendar">
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
    </>
  );
}
