'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/utils/apiFetch';
import { initFirebase, ensureFirebaseSignedIn, auth } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSiteStore } from '@/store/SiteStore';
import { ApiRoute } from '@/entities/Routes';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PhotoUploadModal({ isOpen, onClose, onSuccess }: PhotoUploadModalProps) {
  const { t, i18n } = useTranslation();
  const site = useSiteStore((state) => state.siteInfo);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [anniversaryId, setAnniversaryId] = useState<string>('');
  const [anniversaries, setAnniversaries] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Set default date to today
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [isOpen]);

  // Load anniversaries for optional linking
  useEffect(() => {
    if (isOpen) {
      loadAnniversaries();
    }
  }, [isOpen]);

  const loadAnniversaries = async () => {
    try {
      if (!site?.id) {
        throw new Error('Site ID not found');
      }

      // Fetch anniversaries from previous month and current month
      // (photos are from the past, not future events)
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Calculate previous month
      const prevDate = new Date(currentYear, currentMonth - 1, 1);

      const [prevRes, currRes] = await Promise.all([
        apiFetch<{ events: Array<{ id: string; name: string }> }>(ApiRoute.SITE_ANNIVERSARIES, {
          pathParams: { siteId: site.id },
          queryParams: {
            month: String(prevDate.getMonth()),
            year: String(prevDate.getFullYear()),
          },
        }),
        apiFetch<{ events: Array<{ id: string; name: string }> }>(ApiRoute.SITE_ANNIVERSARIES, {
          pathParams: { siteId: site.id },
          queryParams: {
            month: String(currentMonth),
            year: String(currentYear),
          },
        }),
      ]);

      // Combine and deduplicate by id
      const allEvents = [...(prevRes.events || []), ...(currRes.events || [])];
      const uniqueEvents = Array.from(
        new Map(allEvents.map(event => [event.id, event])).values()
      );

      setAnniversaries(uniqueEvents);
    } catch (err) {
      console.error('Failed to load anniversaries', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageFiles(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

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

    if (imageFiles.length === 0) {
      setError(t('pleaseSelectAtLeastOneImage') || 'Please select at least one image');
      return;
    }

    if (!date) {
      setError(t('pleaseSelectDate') || 'Please select a date');
      return;
    }

    setSaving(true);
    setUploading(true);
    setError('');

    try {
      // Upload images to Firebase Storage
      initFirebase();
      await ensureFirebaseSignedIn();
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Not signed in to Firebase');

      const storage = getStorage();
      const imageUrls = await Promise.all(
        imageFiles.map(async (file, idx) => {
          const blob = await resizeToWebp(file, 1600, 0.9);
          const fileName = `${Date.now()}_${idx}.webp`;
          const path = `gallery/${currentUser.uid}/${fileName}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable'
          });
          return await getDownloadURL(storageRef);
        })
      );

      setUploading(false);

      // POST to /api/photos
      await apiFetch(ApiRoute.SITE_PHOTOS, {
        pathParams: { siteId: site?.id || '' },
        method: 'POST',
        body: {
          date,
          images: imageUrls,
          description: description.trim() || undefined,
          anniversaryId: anniversaryId || undefined,
          locale: i18n.language,
        },
      });

      // Clean up
      previews.forEach(url => URL.revokeObjectURL(url));
      setImageFiles([]);
      setPreviews([]);
      setDescription('');
      setAnniversaryId('');

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Upload failed:', err);
      setError((err as Error).message || t('uploadFailed') || 'Upload failed');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      {/* Mobile: slide up from bottom, Desktop: centered modal */}
      <div className="bg-white w-full sm:max-w-lg sm:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('uploadPhoto') || 'Upload Photo'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('photos') || 'Photos'} *
            </label>

            {previews.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-sage-500 transition">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {t('tapToSelectPhotos') || 'Tap to select photos'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('date') || 'Date'} *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('description') || 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addDescription') || 'Add a description...'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[80px]"
              rows={3}
            />
          </div>

          {/* Anniversary Link (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('linkToAnniversary') || 'Link to Anniversary'} ({t('optional') || 'optional'})
            </label>
            <Select
              value={anniversaryId}
              onChange={setAnniversaryId}
              options={[
                { value: '', label: t('none') || 'None' },
                ...anniversaries.map(ann => ({
                  value: ann.id,
                  label: ann.name,
                }))
              ]}
              placeholder={t('selectAnniversary') || 'Select an anniversary'}
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('linkPhotoToAnniversaryHelp') || 'Link this photo to an anniversary to show it on the calendar'}
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || imageFiles.length === 0}
            >
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? (t('uploading') || 'Uploading...') : (t('upload') || 'Upload')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
