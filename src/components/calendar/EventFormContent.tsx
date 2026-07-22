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
  /** Jump-to-and-highlight the matched event on the calendar instead of saving. */
  onViewSimilarEvent?: (event: AnniversaryEvent) => void;
}

interface MemberOption {
  id: string;
  displayName: string;
}

type HonoreeMode = 'none' | 'member' | 'email';

function formatSimilarEventDate(event: AnniversaryEvent, locale: string): string {
  const year = (event as any).originalYear ?? event.year;
  const month = (event as any).originalMonth ?? event.month;
  const day = (event as any).originalDay ?? event.day;
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(year, month, day),
  );
}

export default function EventFormContent({ editEvent, onSuccess, onViewSimilarEvent }: EventFormContentProps) {
  const { t, i18n } = useTranslation();
  const site = useSiteStore((state) => state.siteInfo);
  const [similarEvent, setSimilarEvent] = useState<AnniversaryEvent | null>(null);
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
  const [honoreeMode, setHonoreeMode] = useState<HonoreeMode>('none');
  const [honoreeMemberId, setHonoreeMemberId] = useState('');
  const [honoreeEmail, setHonoreeEmail] = useState('');
  const [sendInviteNow, setSendInviteNow] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
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
      // For a Hebrew event loaded from a month-grid query, month/day/year may
      // reflect a computed occurrence for whichever month is being browsed, not
      // the originally-entered date - originalYear/Month/Day (when present) is
      // the true value and must be what the edit form pre-fills, or saving here
      // would permanently overwrite the real date with that occurrence's date.
      const year = (editEvent as any).originalYear ?? editEvent.year;
      const month = (editEvent as any).originalMonth ?? editEvent.month;
      const day = (editEvent as any).originalDay ?? editEvent.day;
      setForm({
        name: editEvent.name,
        description: editEvent.description || '',
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        burialDate: (editEvent as any)?.burialDate ? String((editEvent as any).burialDate) : '',
        type: editEvent.type as AnniversaryType,
        isAnnual: editEvent.isAnnual,
        imageUrl: '',
        useHebrew: Boolean((editEvent as any).useHebrew),
      });
      if (editEvent.honoreeMemberId) {
        setHonoreeMode('member');
        setHonoreeMemberId(editEvent.honoreeMemberId);
        setHonoreeEmail('');
      } else if (editEvent.honoreeEmail) {
        setHonoreeMode('email');
        setHonoreeMemberId('');
        setHonoreeEmail(editEvent.honoreeEmail);
      } else {
        setHonoreeMode('none');
        setHonoreeMemberId('');
        setHonoreeEmail('');
      }
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
      setHonoreeMode('none');
      setHonoreeMemberId('');
      setHonoreeEmail('');
    }
    setSendInviteNow(false);
    setImageFile(null);
    setImageSrc('');
  }, [editEvent]);

  // Soft duplicate-name guard: warns, doesn't block - two people can share a name
  // legitimately. Excludes the event currently being edited from its own match.
  useEffect(() => {
    const trimmed = form.name.trim();
    if (trimmed.length < 2) {
      setSimilarEvent(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const data = await apiFetch<{ events: AnniversaryEvent[] }>(ApiRoute.SITE_ANNIVERSARIES_SEARCH, {
          queryParams: { q: trimmed },
        });
        const match = (data.events || []).find((e) => e.id !== editEvent?.id);
        setSimilarEvent(match || null);
      } catch (e) {
        console.error('[EventFormContent] duplicate-name check failed', e);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [form.name, editEvent?.id]);

  useEffect(() => {
    if (imgRef.current) {
      imgRef.current.style.setProperty('--offset-y', `${offsetY}px`);
    }
  }, [offsetY]);

  useEffect(() => {
    apiFetch<{ members: MemberOption[] }>(ApiRoute.SITE_MEMBERS_PUBLIC)
      .then((data) => setMembers(data.members || []))
      .catch((e) => console.error('[EventFormContent] failed to load members for honoree picker', e));
  }, []);

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

      const payload = {
        ...form,
        imageUrl,
        honoreeMemberId: honoreeMode === 'member' ? honoreeMemberId : '',
        honoreeEmail: honoreeMode === 'email' ? honoreeEmail.trim() : '',
        sendInviteNow: honoreeMode === 'email' && !!honoreeEmail.trim() && sendInviteNow,
      };
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
        {similarEvent && (
          <div className="mt-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
            <p>
              {t('similarEventExists', {
                name: similarEvent.name,
                date: formatSimilarEventDate(similarEvent, i18n.language),
              })}{' '}
              {t('continueAnywayQuestion')}
            </p>
            {onViewSimilarEvent && (
              <button
                type="button"
                onClick={() => onViewSimilarEvent(similarEvent)}
                className="underline font-medium"
              >
                {t('viewExistingEvent')}
              </button>
            )}
          </div>
        )}
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
      {form.type !== 'death' && (
        <div>
          <label className="block mb-1 text-sm text-text">{t('honoreeLabel', { defaultValue: 'Who is this for?' })}</label>
          <div className="flex gap-3 text-sm mb-2">
            <button
              type="button"
              onClick={() => setHonoreeMode('member')}
              className={`px-3 py-1 rounded-full border ${honoreeMode === 'member' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-text'}`}
            >
              {t('honoreeExistingMember', { defaultValue: 'Existing member' })}
            </button>
            <button
              type="button"
              onClick={() => setHonoreeMode('email')}
              className={`px-3 py-1 rounded-full border ${honoreeMode === 'email' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-text'}`}
            >
              {t('honoreeNotYetOnSite', { defaultValue: "Not on FamCircle yet" })}
            </button>
            {honoreeMode !== 'none' && (
              <button
                type="button"
                onClick={() => setHonoreeMode('none')}
                className="px-3 py-1 rounded-full border border-gray-300 text-text"
              >
                {t('honoreeNone', { defaultValue: 'None' })}
              </button>
            )}
          </div>
          {honoreeMode === 'member' && (
            <select
              className="border rounded w-full px-3 py-2"
              value={honoreeMemberId}
              onChange={(e) => setHonoreeMemberId(e.target.value)}
            >
              <option value="">{t('honoreeSelectMember', { defaultValue: 'Select a member...' })}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          )}
          {honoreeMode === 'email' && (
            <div>
              <input
                type="email"
                className="border rounded w-full px-3 py-2"
                value={honoreeEmail}
                onChange={(e) => setHonoreeEmail(e.target.value)}
                placeholder={t('honoreeEmailPlaceholder', { defaultValue: "Their email address" }) as string}
              />
              {honoreeEmail.trim() && (
                <label className="flex items-center gap-2 mt-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={sendInviteNow}
                    onChange={(e) => setSendInviteNow(e.target.checked)}
                  />
                  {t('honoreeSendInviteNow', { defaultValue: 'Send them an invite now, to join and read their blessings' })}
                </label>
              )}
            </div>
          )}
        </div>
      )}
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
