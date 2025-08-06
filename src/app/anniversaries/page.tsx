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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{t('anniversaries')}</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul className="mb-8 space-y-2">
          {events.length === 0 && <li>{t('noEventsThisMonth')}</li>}
          {events.map((ev) => (
            <li key={ev.id} className="border p-3 rounded">
              <div className="font-semibold">
                {ev.name} - {ev.day}/{ev.month + 1}
              </div>
              <div className="text-sm text-gray-600">
                {ev.type}
                {ev.description ? ` - ${ev.description}` : ''}
              </div>
            </li>
          ))}
        </ul>
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
    </div>
  );
}
