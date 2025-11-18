'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import type { AnniversaryEvent, AnniversaryType } from '@/entities/Anniversary';
import styles from '@/app/app/calendar/page.module.css';
import { ImageStore } from '@/store/ImageStore';
import ImageUploadArea from '@/components/ui/ImageUploadArea';
import DateInput from '@/components/ui/DateInput';
import { useSiteStore } from '@/store/SiteStore';
import TouchSelect from '@/components/ui/TouchSelect';

interface EventFormContentProps {
  editEvent?: AnniversaryEvent | null;
  onSuccess: () => void;
}

export default function EventFormContent({ editEvent, onSuccess }: EventFormContentProps) {
  const { t, i18n } = useTranslation();
  const site = useSiteStore((state) => state.siteInfo);
  const [form, setForm] = useState({
    name: '',
    description: '',
    date: '',
    burialDate: '',
    type: 'other' as AnniversaryType | '',
    isAnnual: true,
    imageUrl: '',
    useHebrew: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState('');
  const [offsetY, setOffsetY] = useState(0);
  const [maxOffsetY, setMaxOffsetY] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (editEvent) {
      setForm({
        name: editEvent.name,
        description: editEvent.description || '',
        date: `${editEvent.year}-${String(editEvent.month + 1).padStart(2, '0')}-${String(editEvent.day).padStart(2, '0')}`,
        burialDate: (editEvent as any)?.burialDate ? String((editEvent as any).burialDate) : '',
        type: editEvent.type as AnniversaryType,
        isAnnual: editEvent.isAnnual,
        imageUrl: '',
        useHebrew: Boolean((editEvent as any).useHebrew),
      });
    } else {
      setForm({
        name: '',
        description: '',
        date: '',
        burialDate: '',
        type: 'other' as AnniversaryType | '',
        isAnnual: true,
        imageUrl: '',
        useHebrew: false,
      });
    }
    setImageFile(null);
    setImageSrc('');
  }, [editEvent]);

  useEffect(() => {
    if (imgRef.current) {
      imgRef.current.style.setProperty('--offset-y', `${offsetY}px`);
    }
  }, [offsetY]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePreview = () => {
    setImageSrc('');
    setImageFile(null);
    setForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const onImageLoad = () => {
    const img = imgRef.current;
    const container = cropRef.current;
    if (!img || !container) return;
    const scaledHeight = (img.naturalHeight * container.offsetWidth) / img.naturalWidth;
    const excess = Math.max(0, scaledHeight - container.offsetHeight);
    setMaxOffsetY(excess);
    setOffsetY(excess / 2);
  };

  const handleCrop = async () => {
    const img = imgRef.current;
    const container = cropRef.current;
    if (!img || !container) return;

    try {
      const croppedFile = await ImageStore.cropImage(img, container.offsetWidth, container.offsetHeight, offsetY);
      setImageFile(croppedFile);
      const dataUrl = URL.createObjectURL(croppedFile);
      setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      setImageSrc('');
    } catch (err) {
      console.error('Failed to crop image:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let imageUrl = editEvent?.imageUrl || '';
      if (imageFile) {
        imageUrl = await ImageStore.uploadAnniversaryImage(imageFile);
      }

      if (!site?.id) {
        throw new Error('Site ID not found');
      }

      const payload = { ...form, imageUrl };
      if (!payload.type) {
        setError(t('pleaseFillAllFields'));
        setSaving(false);
        return;
      }
      if (editEvent) {
        await apiFetch<void>(ApiRoute.SITE_ANNIVERSARY_BY_ID, {
          pathParams: { anniversaryId: editEvent.id },
          method: 'PUT',
          body: payload,
        });
      } else {
        await apiFetch<void>(ApiRoute.SITE_ANNIVERSARIES, {
          method: 'POST',
          body: payload,
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  const dateContext =
    form.type === 'birthday' || form.type === 'death'
      ? 'past'
      : form.type === 'wedding'
        ? 'nearFuture'
        : undefined;

  const anniversaryTypeOptions = [
    { value: 'birthday', label: `🎂 ${t('birthday')}` },
    { value: 'wedding', label: `💍 ${t('wedding')}` },
    { value: 'death', label: `🕯️ ${t('death')}` },
    { value: 'other', label: `⭐ ${t('other', { defaultValue: 'Other' })}` },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && <div className="text-red-600">{error}</div>}
      <div>
        <label className="block mb-1 text-sm text-text">{t('name')}</label>
        <input
          className="border rounded w-full px-3 py-2"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block mb-1 text-sm text-text">{t('description')}</label>
        <textarea
          className="border rounded w-full px-3 py-2"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <TouchSelect
          value={form.type}
          options={anniversaryTypeOptions}
          onChange={(val) => setForm({ ...form, type: val as typeof form.type })}
          columns={4}
        />
        <DateInput
          value={form.date}
          onChange={(value) => setForm({ ...form, date: value })}
          required
          context={dateContext}
          todayIcon={
            form.type === 'death' ? '🕯️' : form.type === 'wedding' ? '💍' : '👶'
          }
          className="mx-auto"
        />
      </div>
      {form.type === 'death' && (
        <div>
          <label className="block mb-1 text-sm text-text">
            {t('burialDate', { defaultValue: 'Burial date' })}
          </label>
          <DateInput
            value={form.burialDate}
            onChange={(value) => setForm((prev) => ({ ...prev, burialDate: value }))}
            context="past"
            todayIcon="🕯️"
          />
          <p className="text-xs text-sage-600 mt-1">
            {t('burialDateHelp', { defaultValue: 'Optional: if burial occurred on a different date.' })}
          </p>
        </div>
      )}
      <div>
        <label className="block mb-1 text-sm text-text">{t('image')}</label>
        {editEvent?.imageUrl && !imageSrc && !form.imageUrl && (
          <div className="mb-3">
            <img src={editEvent.imageUrl} alt="" className="w-full h-40 object-cover rounded-lg"/>
          </div>
        )}
        {!imageSrc && !form.imageUrl && (
          <ImageUploadArea
            previews={[]}
            onFileChange={onFileChange}
            onRemoveImage={handleRemovePreview}
            multiple={false}
          />
        )}
        {imageSrc && (
          <div className="mt-2">
            <div
              ref={cropRef}
              className="relative w-full aspect-[16/9] overflow-hidden bg-gray-200"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                onLoad={onImageLoad}
                className={styles.cropImage}
                alt="crop source"
              />
            </div>
            {maxOffsetY > 0 && (
              <input
                type="range"
                min={0}
                max={maxOffsetY}
                value={offsetY}
                onChange={(e) => setOffsetY(Number(e.target.value))}
                className="w-full mt-2"
              />
            )}
            <button
              type="button"
              onClick={handleCrop}
              className="mt-2 bg-primary text-white px-4 py-2 rounded"
            >
              {t('cropImage')}
            </button>
            {form.imageUrl && (
              <img src={form.imageUrl} alt="preview" className="w-full mt-2 rounded"/>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center">
        <input
          id="useHebrew"
          type="checkbox"
          checked={form.useHebrew}
          onChange={(e) => setForm({ ...form, useHebrew: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="useHebrew" className="text-text">{t('hebrewCalendar') as string}</label>
      </div>
      {form.useHebrew && form.date && (
        <div className="text-sm text-sage-700">
          {t('hebrewDate') as string}: {new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(form.date))}
        </div>
      )}
      <button
        type="submit"
        disabled={saving}
        className="bg-primary text-white px-4 py-2 rounded hover:bg-secondary disabled:opacity-50"
      >
        {saving
          ? t('saving')
          : editEvent
            ? t('updateEvent')
            : t('addEvent')}
      </button>
    </form>
  );
}
