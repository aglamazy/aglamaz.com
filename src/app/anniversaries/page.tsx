'use client';

import { useEffect, useRef, useState, ChangeEvent } from 'react';
import Modal from '@/components/ui/Modal';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon } from 'lucide-react';
import { initFirebase } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';

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
  const user = useUserStore((s) => s.user);
  const member = useMemberStore((state) => state.member);
  const { t } = useTranslation();

  const [imageSrc, setImageSrc] = useState('');
  const [offsetY, setOffsetY] = useState(0);
  const [maxOffsetY, setMaxOffsetY] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/anniversaries');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initFirebase();
    fetchEvents();
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let imageUrl = editEvent?.imageUrl || '';
      if (imageFile && user?.user_id) {
        const storage = getStorage();
        const storageRef = ref(
          storage,
          `anniversaries/${user.user_id}/${Date.now()}_${imageFile.name}`
        );
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const payload = { ...form, imageUrl };
      let res: Response;
      if (editEvent) {
        res = await fetch(`/api/anniversaries/${editEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/anniversaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        setForm({ name: '', description: '', date: '', type: 'birthday', isAnnual: true });
        setImageFile(null);
        setEditEvent(null);
        setIsModalOpen(false);
        setForm({ name: '', description: '', date: '', type: 'birthday', isAnnual: true, imageUrl: '' });
        setImageSrc('');
        fetchEvents();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!confirm('Are you sure?')) return;
      await fetch(`/api/anniversaries/${id}`, { method: 'DELETE' });
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventsThisMonth = events.filter((ev) => ev.month === month);
  const today = new Date();

  const dayCells = [];
  for (let i = 0; i < firstDay; i++) {
    dayCells.push(<div key={`empty-${i}`} className="border p-2 h-24 rounded-xl shadow-md" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = eventsThisMonth.filter((ev) => ev.day === day);
    const isToday =
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
    dayCells.push(
      <div
        key={day}
        className="border p-2 h-32 rounded-xl shadow-md hover:bg-emerald-50 transition-colors relative overflow-hidden"
        dir={document.documentElement.dir}
      >
        <div className={`absolute top-1 ${document.documentElement.dir === 'rtl' ? 'right-1' : 'left-1'} flex items-center`}>
          <span className="font-bold text-sm">{day}</span>
          {dayEvents.length > 0 && (
            <span className="ml-3 text-xs">{dayEvents[0].name}</span>
          )}
        </div>
        {dayEvents.map((ev) => (
          <div
            key={ev.id}
            onClick={() => setSelectedEvent(ev)}
            className="mt-6 flex flex-col items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs cursor-pointer"
          >
            {ev.imageUrl && (
              <img src={ev.imageUrl} alt="" className="w-full h-20 object-cover mt-1 rounded" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{t('anniversaries')}</h1>
      <div className="mb-4 flex justify-center">
        <input
          type="month"
          value={`${year}-${String(month + 1).padStart(2, '0')}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-').map(Number);
            setSelectedDate(new Date(y, m - 1, 1));
          }}
          className="border rounded px-3 py-2"
        />
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {eventsThisMonth.length === 0 && (
            <div className="mb-2">{t('noEventsThisMonth')}</div>
          )}
          <div className="grid grid-cols-7 gap-2 mb-8 text-center p-4 rounded-lg bg-gradient-to-b from-slate-50 to-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="font-semibold text-lg">
                {d}
              </div>
            ))}
            {dayCells}
          </div>
        </>
      )}

      <button
        onClick={() => {
          setForm({ name: '', description: '', date: '', type: 'birthday', isAnnual: true });
          setEditEvent(null);
          setImageFile(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-4 right-1/2 transform translate-x-1/2 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-secondary"
      >
        +
      </button>

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
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm text-text">{t('image')}</label>
            {editEvent?.imageUrl && !imageFile && (
              <img src={editEvent.imageUrl} alt="" className="mb-2 max-h-40" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-text">{t('image')}</label>
            <input type="file" accept="image/*" onChange={onFileChange} />
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
                    style={{ width: '100%', transform: `translateY(-${offsetY}px)` }}
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
                  <img src={form.imageUrl} alt="preview" className="w-full mt-2 rounded" />
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
                    });
                    setEditEvent(selectedEvent);
                    setImageFile(null);
                    setSelectedEvent(null);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1 bg-primary text-white rounded"
                >
                  {t('edit')}
                </button>
                <button
                  onClick={() => handleDelete(selectedEvent.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
