"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { initFirebase, ensureFirebaseSignedIn, auth } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function NewOccurrencePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params?.id || '';
  const [date, setDate] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImageFiles(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  // Default occurrence date to same day/month as anniversary (current year)
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ event: { month?: number; day?: number; useHebrew?: boolean; hebrewOccurrences?: Array<{ year: number; month: number; day: number }> } }>(`/api/anniversaries/${eventId}`);
        const now = new Date();
        let m = (res.event?.month ?? now.getMonth());
        let d = (res.event?.day ?? now.getDate());
        if (res.event?.useHebrew && Array.isArray(res.event?.hebrewOccurrences)) {
          const occ = res.event.hebrewOccurrences.find((o: any) => o.year === now.getFullYear());
          if (occ) { m = occ.month; d = occ.day; }
        }
        const yyyy = now.getFullYear();
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        setDate(`${yyyy}-${mm}-${dd}`);
      } catch {
        // leave empty if fetch fails
      }
    })();
  }, [eventId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await apiFetch<{ event: { id: string } }>(
        `/api/anniversaries/${eventId}/events`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        }
      );
      const id = data?.event?.id;
      if (!id) throw new Error('Invalid response: missing id');

      // If images selected: resize to 1600px, convert to webp, upload, update occurrence with URLs
      if (imageFiles.length > 0) {
        try {
          initFirebase();
          await ensureFirebaseSignedIn();
          const currentUser = auth().currentUser;
          if (!currentUser) throw new Error('Not signed in to Firebase');
          const storage = getStorage();
          const uploads = await Promise.all(
            imageFiles.map(async (file, idx) => {
              const blob = await resizeToWebp(file, 1600, 0.9);
              const fileName = `${Date.now()}_${idx}.webp`;
              const path = `anniversaries/${currentUser.uid}/events/${eventId}/${id}/${fileName}`;
              const storageRef = ref(storage, path);
              await uploadBytes(storageRef, blob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' });
              return await getDownloadURL(storageRef);
            })
          );
          await apiFetch(`/api/anniversaries/${eventId}/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addImages: uploads }),
          });
        } catch (e) {
          console.error('Occurrence image upload failed', e);
          // Continue to details even if some uploads fail
        }
      }
      router.push(`/anniversaries/${eventId}/events/${id}`);
      return true;
    } catch (err) {
      console.error(err);
      setError(t('errorOccurred'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t('newOccurrence')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-text">{t('date')}</label>
            <input
              type="date"
              className="border rounded w-full px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-text">{t('image')}</label>
            {previews.length > 0 && (
              <div className="mb-2 grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="max-h-32 w-full object-cover rounded" />
                ))}
              </div>
            )}
            <input type="file" accept="image/*" multiple onChange={onFileChange} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
