'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useTranslation } from 'react-i18next';

interface AnniversaryEvent {
  id: string;
  name: string;
  description?: string;
  type: string;
  day: number;
  month: number;
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AnniversaryEvent | null>(null);
  const { t } = useTranslation();

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
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/anniversaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', description: '', date: '', type: 'birthday', isAnnual: true });
        fetchEvents();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventsThisMonth = events.filter((ev) => ev.month === month);

  const dayCells = [];
  for (let i = 0; i < firstDay; i++) {
    dayCells.push(<div key={`empty-${i}`} className="border p-2 h-24" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = eventsThisMonth.filter((ev) => ev.day === day);
    dayCells.push(
      <div key={day} className="border p-2 h-24">
        <div className="text-xs font-bold">{day}</div>
        {dayEvents.map((ev) => (
          <div
            key={ev.id}
            onClick={() => setSelectedEvent(ev)}
            className="text-xs cursor-pointer hover:underline"
          >
            {ev.name}
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
          <div className="grid grid-cols-7 gap-2 mb-8 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="font-semibold">
                {d}
              </div>
            ))}
            {dayCells}
          </div>
        </>
      )}

      <button
        onClick={() => setIsModalOpen(true)}
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
            {saving ? t('saving') : t('addEvent')}
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)}>
        {selectedEvent && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{selectedEvent.name}</h2>
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
          </div>
        )}
      </Modal>
    </div>
  );
}
