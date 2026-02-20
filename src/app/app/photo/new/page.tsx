'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/utils/apiFetch';
import { ImageStore } from '@/store/ImageStore';
import ImageUploadArea from '@/components/ui/ImageUploadArea';
import DateInput from '@/components/ui/DateInput';
import { ApiRoute } from '@/utils/urls';
import { ensureDecodableImage } from '@/utils/heicConvert';

export default function NewPhotoPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [description, setDescription] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [anniversaryId, setAnniversaryId] = useState<string>('');
  const [anniversaries, setAnniversaries] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Load anniversaries for optional linking
  useEffect(() => {
    loadAnniversaries();
  }, []);

  const loadAnniversaries = async () => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const prevDate = new Date(currentYear, currentMonth - 1, 1);

      const [prevRes, currRes] = await Promise.all([
        apiFetch<{ events: Array<{ id: string; name: string }> }>(ApiRoute.SITE_ANNIVERSARIES, {
          queryParams: {
            month: String(prevDate.getMonth()),
            year: String(prevDate.getFullYear()),
          },
        }),
        apiFetch<{ events: Array<{ id: string; name: string }> }>(ApiRoute.SITE_ANNIVERSARIES, {
          queryParams: {
            month: String(currentMonth),
            year: String(currentYear),
          },
        }),
      ]);

      const allEvents = [...(prevRes.events || []), ...(currRes.events || [])];
      const uniqueEvents = Array.from(
        new Map(allEvents.map(event => [event.id, event])).values()
      );

      setAnniversaries(uniqueEvents);
    } catch (err) {
      console.error('Failed to load anniversaries', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const files = await Promise.all(rawFiles.map(ensureDecodableImage));
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
      const imageUrls = await Promise.all(
        imageFiles.map(async (file) => {
          return await ImageStore.uploadGalleryPhoto(file, 1600, 0.9);
        })
      );

      setUploading(false);

      // POST to /api/site/[siteId]/photos
      await apiFetch(ApiRoute.SITE_PHOTOS, {
        method: 'POST',
        body: {
          date,
          images: imageUrls,
          description: description.trim() || undefined,
          anniversaryId: anniversaryId || undefined,
          locale: i18n.language,
        },
      });

      // Navigate back to feed
      router.push('/app');
    } catch (err) {
      console.error('Upload failed:', err);
      setError((err as Error).message || t('uploadFailed') || 'Upload failed');
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-semibold">{t('uploadPhoto') || 'Upload Photo'}</h1>
        <button
          onClick={() => router.back()}
          className="p-1 hover:bg-gray-100 rounded-full"
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
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
          <ImageUploadArea
            previews={previews}
            onFileChange={handleFileChange}
            onRemoveImage={removeImage}
            multiple={true}
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('date') || 'Date'} *
          </label>
          <DateInput
            value={date}
            onChange={setDate}
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
            onClick={() => router.back()}
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
  );
}
