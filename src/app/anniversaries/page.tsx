'use client';

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import Modal from '@/components/ui/Modal';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon } from 'lucide-react';

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
  const prevMonth = month === 0 ? 11 : month - 1;
  const nextMonth = (month + 1) % 12;
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const eventsPrevMonth = events.filter((ev) => ev.month === prevMonth);
  const eventsThisMonth = events.filter((ev) => ev.month === month);
  const eventsNextMonth = events.filter((ev) => ev.month === nextMonth);
  const today = new Date();

  const renderDayCell = (
    day: number,
    dayEvents: AnniversaryEvent[],
    key: string,
    isOutsideMonth = false
  ) => {
    const isToday =
      !isOutsideMonth &&
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
    return (
      <div
        key={key}
        className={`border p-2 h-24 rounded-xl shadow-md ${
          isOutsideMonth
            ? 'bg-gray-100 text-gray-400'
            : 'hover:bg-emerald-50 transition-colors'
        }`}
      >
        <div
          className={`font-bold w-6 h-6 flex items-center justify-center mx-auto mb-1 ${
            isToday
              ? 'bg-emerald-200 text-emerald-900 rounded-full text-base'
              : 'text-sm'
          }`}
        >
          {day}
        </div>
        {dayEvents.map((ev) => (
          <div
            key={ev.id}
            onClick={() => setSelectedEvent(ev)}
            className={`mt-1 flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer ${
              isOutsideMonth
                ? 'bg-gray-200 text-gray-500'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            <CalendarIcon className="w-3 h-3" />
            {ev.name}
          </div>
        ))}
      </div>
    );
  };

  const dayCells: JSX.Element[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dayEvents = eventsPrevMonth.filter((ev) => ev.day === day);
    dayCells.push(renderDayCell(day, dayEvents, `prev-${day}`, true));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = eventsThisMonth.filter((ev) => ev.day === day);
    dayCells.push(renderDayCell(day, dayEvents, `curr-${day}`));
  }
  const totalCells = firstDay + daysInMonth;
  const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= trailingCells; i++) {
    const dayEvents = eventsNextMonth.filter((ev) => ev.day === i);
    dayCells.push(renderDayCell(i, dayEvents, `next-${i}`, true));
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
