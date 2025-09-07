'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, ChangeEvent } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import { initFirebase, auth, ensureFirebaseSignedIn } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUserStore } from '@/store/UserStore';
import { MembershipStatus, useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';
import styles from './page.module.css';
import AddFab from '@/components/ui/AddFab';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnniversaryEvent {
  id: string;
  name: string;
  description?: string;
  type: string;
  day: number;
  month: number;
  year: number;
  isAnnual: boolean;
  ownerId: string;
  imageUrl?: string;
}

export default function AnniversariesPage() {
  const [events, setEvents] = useState<AnniversaryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    description: '',
    date: '',
    type: 'birthday',
    isAnnual: true,
    imageUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AnniversaryEvent | null>(null);
  const [editEvent, setEditEvent] = useState<AnniversaryEvent | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnniversaryEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const user = useUserStore((s) => s.user);
  const checkAuth = useUserStore((s) => s.checkAuth);
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((s) => s.fetchMember);
  const siteInfo = useSiteStore((s) => s.siteInfo);
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [imageSrc, setImageSrc] = useState('');
  const [offsetY, setOffsetY] = useState(0);
  const [maxOffsetY, setMaxOffsetY] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isSmUp, setIsSmUp] = useState(false);
  const truncateName = (name: string, max = 6) =>
    name && name.length > max ? `${name.slice(0, max)}…` : name;
  const truncateResponsive = (name: string, mobileLen: number, desktopLen: number) =>
    truncateName(name, isSmUp ? desktopLen : mobileLen);
  const preloaded = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (imgRef.current) {
      imgRef.current.style.setProperty('--offset-y', `${offsetY}px`);
    }
  }, [offsetY]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ events: AnniversaryEvent[] }>('/api/anniversaries');
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initFirebase();
    fetchEvents();
  }, []);

  // Track breakpoint (Tailwind 'sm': 640px)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 640px)');
    const set = () => setIsSmUp(mql.matches);
    set();
    mql.addEventListener?.('change', set);
    return () => mql.removeEventListener?.('change', set);
  }, []);

  // Preload event images to reduce perceived lag when opening modal
  useEffect(() => {
    const con: any = (navigator as any).connection;
    const saveData = !!con?.saveData;
    const slow = con?.effectiveType && /^(2g|slow-2g)$/i.test(con.effectiveType);
    if (saveData || slow) return; // respect data saver / very slow connections

    const urls = events
      .map((e) => e.imageUrl || '')
      .filter((u) => u && !preloaded.current.has(u));
    // Cap preloads to a reasonable number
    const toLoad = urls.slice(0, 12);
    toLoad.forEach((u) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
      preloaded.current.add(u);
    });
  }, [events]);

  // Ensure user session is populated on this route too (not only in app layout)
  useEffect(() => {
    (async () => {
      try {
        await checkAuth();
      } catch (e) {
        console.error('[Anniversaries][debug] checkAuth failed', e);
      }
    })();
  }, [checkAuth]);

  // After user + site are known, fetch member to populate role
  useEffect(() => {
    (async () => {
      const uid = user?.user_id;
      const sid = siteInfo?.id;
      if (!uid || !sid) return;
      try {
        await fetchMember(uid, sid);
      } catch (e) {
        console.error('[Anniversaries][debug] fetchMember failed', e);
      }
    })();
  }, [user?.user_id, siteInfo?.id, fetchMember]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
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

  const handleCrop = () => {
    const img = imgRef.current;
    const container = cropRef.current;
    if (!img || !container) return;
    const scale = img.naturalWidth / container.offsetWidth;
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      img,
      0,
      offsetY * scale,
      container.offsetWidth * scale,
      container.offsetHeight * scale,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const dataUrl = canvas.toDataURL('image/jpeg');
    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = imageFile?.name || 'cropped.jpg';
      const croppedFile = new File([blob], fileName, { type: 'image/jpeg' });
      setImageFile(croppedFile);
    }, 'image/jpeg');
    setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
    setImageSrc(''); // Hide the original image
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let imageUrl = editEvent?.imageUrl || '';
      if (imageFile) {
        // Ensure Firebase Auth is aligned with the app session before Storage ops
        try {
          await ensureFirebaseSignedIn();
        } catch (e) {
          setError('Failed to authenticate with Firebase');
          throw e instanceof Error ? e : new Error('firebase-auth-failed');
        }
        const currentUser = auth().currentUser;
        if (!currentUser) {
          const err = new Error('Not signed in to Firebase');
          setError(err.message);
          throw err;
        }
        const storage = getStorage();
        const storageRef = ref(
          storage,
          `anniversaries/${currentUser.uid}/${Date.now()}_${imageFile.name}`
        );
        await uploadBytes(storageRef, imageFile, {
          cacheControl: 'public, max-age=31536000, immutable',
        });
        imageUrl = await getDownloadURL(storageRef);
      }

      const payload = { ...form, imageUrl };
      if (editEvent) {
        await apiFetch<void>(`/api/anniversaries/${editEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<void>('/api/anniversaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setForm({ name: '', description: '', date: '', type: 'birthday', isAnnual: true, imageUrl: '' });
      setImageFile(null);
      setEditEvent(null);
      setIsModalOpen(false);
      setImageSrc('');
      fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openConfirmDelete = (event: AnniversaryEvent) => {
    setDeleteTarget(event);
    setDeleteError('');
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch<void>(`/api/anniversaries/${deleteTarget.id}`, { method: 'DELETE' });
      setConfirmOpen(false);
      setDeleteTarget(null);
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      setDeleteError(msg);
      // Rethrow so callers can handle (e.g., toast)
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventsThisMonth = events.filter((ev) => ev.month === month);
  const today = new Date();

  const prevMonthDate = new Date(year, month, 0);
  const daysInPrevMonth = prevMonthDate.getDate();
  const prevMonth = prevMonthDate.getMonth();
  const prevYear = prevMonthDate.getFullYear();
  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonth = nextMonthDate.getMonth();
  const nextYear = nextMonthDate.getFullYear();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const dayCells = [];
  for (let i = 0; i < totalCells; i++) {
    let cellDay;
    let cellMonth = month;
    let cellYear = year;
    let isCurrentMonth = true;

    if (i < firstDay) {
      cellDay = daysInPrevMonth - firstDay + i + 1;
      cellMonth = prevMonth;
      cellYear = prevYear;
      isCurrentMonth = false;
    } else if (i >= firstDay + daysInMonth) {
      cellDay = i - (firstDay + daysInMonth) + 1;
      cellMonth = nextMonth;
      cellYear = nextYear;
      isCurrentMonth = false;
    } else {
      cellDay = i - firstDay + 1;
    }

    const dayEvents = events.filter(
      (ev) => ev.month === cellMonth && ev.day === cellDay
    );
    const isToday =
      cellDay === today.getDate() &&
      cellMonth === today.getMonth() &&
      cellYear === today.getFullYear();

    dayCells.push(
      <div
        key={`${cellYear}-${cellMonth}-${cellDay}`}
        className={`border p-1 sm:p-2 h-24 sm:h-32 rounded-xl shadow-md transition-colors relative overflow-hidden ${
          isCurrentMonth ? 'hover:bg-emerald-50' : 'text-gray-400 bg-gray-50'
        }`}
        dir={i18n.dir()}
      >
        <div
          className={`absolute top-1 pointer-events-none ${
            i18n.dir() === 'rtl' ? 'right-1' : 'left-1'
          } flex items-center`}
        >
          <span className="font-bold text-sm">{cellDay}</span>
          {dayEvents.length === 1 && !dayEvents[0].imageUrl && (
            <span className={`ml-2 text-xs ${styles.nameMobile}`}>
              {truncateResponsive(dayEvents[0].name, 6, 12)}
            </span>
          )}
        </div>
        {dayEvents.length > 1 ? (
          <div className={`mt-4 sm:mt-6 flex flex-col gap-1 ${isCurrentMonth ? '' : 'opacity-50'}`}>
            {dayEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => {
                  setSelectedEvent(ev);
                }}
                className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded cursor-pointer text-[10px] sm:text-xs"
              >
                <span className={styles.nameMobile}>{truncateResponsive(ev.name, 6, 16)}</span>
              </div>
            ))}
          </div>
        ) : (
          dayEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={() => {
                setSelectedEvent(ev);
              }}
              className={`mt-6 sm:mt-7 flex flex-col items-center gap-1 text-xs cursor-pointer ${
                ev.imageUrl ? 'p-0 bg-transparent' : 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full'
              } ${isCurrentMonth ? '' : 'opacity-50'}`}
            >
              {ev.imageUrl && (
                <img
                  src={ev.imageUrl}
                  alt=""
                  className="w-full h-16 sm:h-20 object-cover rounded"
                />
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  const handlePrevMonth = () => {
    setSelectedDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const onGridTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onGridTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Horizontal swipe with limited vertical movement
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) {
      if (dx < 0) handleNextMonth();
      else handlePrevMonth();
    }
    touchStartRef.current = null;
  };

  return (
    <div className="container mx-auto px-2 py-2 sm:px-4 sm:py-4">
      <h1 className="text-2xl font-bold mb-2 sm:mb-4">{t('familyCalendar')}</h1>
      <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2">
        <Button
          aria-label="Previous month"
          onClick={handlePrevMonth}
          className="px-3 py-2 rounded-full"
        >
          {i18n.dir() === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
        <input
          type="month"
          value={`${year}-${String(month + 1).padStart(2, '0')}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-').map(Number);
            setSelectedDate(new Date(y, m - 1, 1));
          }}
          className="border rounded px-3 py-2"
        />
        <Button
          aria-label="Next month"
          onClick={handleNextMonth}
          className="px-3 py-2 rounded-full"
        >
          {i18n.dir() === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </Button>
        <Button
          aria-label="Today"
          onClick={handleToday}
          className="ml-1 text-xs sm:text-sm"
        >
          {t('today')}
        </Button>
      </div>
      {loading ? (
        <div>{t('loading')}</div>
      ) : (
        <>
          {eventsThisMonth.length === 0 && (
            <div className="mb-2">{t('noEventsThisMonth')}</div>
          )}
          <div
            className="grid grid-cols-7 gap-1 sm:gap-2 mb-6 sm:mb-8 text-center p-2 sm:p-4 rounded-lg bg-gradient-to-b from-slate-50 to-slate-200"
            onTouchStart={onGridTouchStart}
            onTouchEnd={onGridTouchEnd}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="font-semibold text-lg">
                {d}
              </div>
            ))}
            {dayCells}
          </div>
        </>
      )}

      <AddFab
        ariaLabel={t('add') as string}
        onClick={() => {
          setForm({ name: '', description: '', date: '', type: 'birthday', isAnnual: true, imageUrl: '' });
          setEditEvent(null);
          setImageFile(null);
          setImageSrc('');
          setIsModalOpen(true);
        }}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
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
          <div>
            <label className="block mb-1 text-sm text-text">{t('date')}</label>
            <input
              type="date"
              className="border rounded w-full px-3 py-2"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-text">{t('type')}</label>
            <select
              className="border rounded w-full px-3 py-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="birthday">{t('birthday')}</option>
              <option value="death">{t('death')}</option>
              <option value="wedding">{t('wedding')}</option>
              <option value="death_anniversary">{t('death_anniversary')}</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm text-text">{t('image')}</label>
            {editEvent?.imageUrl && !imageSrc && (
              <img src={editEvent.imageUrl} alt="" className="mb-2 max-h-40"/>
            )}
            <input type="file" accept="image/*" onChange={onFileChange}/>
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
              id="isAnnual"
              type="checkbox"
              checked={form.isAnnual}
              onChange={(e) => setForm({ ...form, isAnnual: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isAnnual" className="text-text">{t('annualEvent')}</label>
          </div>
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
      </Modal>

      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)}>
        {selectedEvent && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{selectedEvent.name}</h2>
            {selectedEvent.imageUrl && (
              <img
                src={selectedEvent.imageUrl}
                alt=""
                className="mb-2 max-h-60 w-full object-cover"
                loading="eager"
                decoding="async"
              />
            )}
            <div>
              {t('date')}: {selectedEvent.day}/{selectedEvent.month + 1}
            </div>
            <div>
              {t('type')}: {selectedEvent.type}
            </div>
            {selectedEvent.description && (
              <div>
                {t('description')}: {selectedEvent.description}
              </div>
            )}
            <button
              onClick={() => router.push(`/anniversaries/${selectedEvent.id}/occurrences/new`)}
              className="px-3 py-1 bg-primary text-white rounded"
            >
              {t('addOccurrence')}
            </button>
            {(user?.user_id === selectedEvent.ownerId || member?.role === 'admin') && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setForm({
                      name: selectedEvent.name,
                      description: selectedEvent.description || '',
                      date: `${selectedEvent.year}-${String(selectedEvent.month + 1).padStart(2, '0')}-${String(selectedEvent.day).padStart(2, '0')}`,
                      type: selectedEvent.type,
                      isAnnual: selectedEvent.isAnnual,
                      imageUrl: '',
                    });
                    setEditEvent(selectedEvent);
                    setImageFile(null);
                    setImageSrc('');
                    setSelectedEvent(null);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1 bg-primary text-white rounded"
                >
                  {t('edit')}
                </button>
                <button
                  onClick={() => openConfirmDelete(selectedEvent)}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        title={'Delete Event?'}
        message={deleteTarget ? `${deleteTarget.name} — ${deleteTarget.day}/${deleteTarget.month + 1}/${deleteTarget.year}` : ''}
        confirmLabel={'Delete'}
        cancelLabel={'Cancel'}
        destructive
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setDeleteTarget(null);
          setDeleteError('');
        }}
      />
    </div>
  );
}
