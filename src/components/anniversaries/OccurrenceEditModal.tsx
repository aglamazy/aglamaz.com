'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { useTranslation } from 'react-i18next';

export interface OccurrenceForEdit {
  id: string;
  eventId?: string;
  date: any;
  description?: string;
  images?: string[];
}

interface OccurrenceEditModalProps {
  anniversaryId: string;
  occurrenceId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (occurrence: OccurrenceForEdit) => void;
  initialOccurrence?: OccurrenceForEdit | null;
}

function getDateInputValue(raw: any): string {
  try {
    if (!raw) return '';
    const jsDate = raw?.toDate
      ? raw.toDate()
      : typeof raw?._seconds === 'number'
        ? new Date(raw._seconds * 1000)
        : typeof raw?.seconds === 'number'
          ? new Date(raw.seconds * 1000)
          : new Date(raw);
    if (!(jsDate instanceof Date) || Number.isNaN(jsDate.getTime())) return '';
    const yyyy = jsDate.getFullYear();
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (err) {
    console.error('[OccurrenceEditModal] failed to parse date', err);
    throw err;
  }
}

export default function OccurrenceEditModal({
  anniversaryId,
  occurrenceId,
  isOpen,
  onClose,
  onUpdated,
  initialOccurrence,
}: OccurrenceEditModalProps) {
  const { t } = useTranslation();
  const [occurrence, setOccurrence] = useState<OccurrenceForEdit | null>(initialOccurrence ?? null);
  const [dateValue, setDateValue] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const shouldLoad = useMemo(() => {
    return isOpen && !loading && !occurrence && !initialOccurrence;
  }, [isOpen, loading, occurrence, initialOccurrence]);

  useEffect(() => {
    setOccurrence(initialOccurrence ?? null);
  }, [initialOccurrence?.id, initialOccurrence]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (initialOccurrence) {
      try {
        setDateValue(getDateInputValue(initialOccurrence.date));
      } catch (err) {
        setError('load');
        throw err;
      }
      setDescription(initialOccurrence.description || '');
    }
  }, [initialOccurrence, isOpen]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await apiFetch<{ event: OccurrenceForEdit }>(
          `/api/anniversaries/${anniversaryId}/events/${occurrenceId}`
        );
        if (cancelled) return;
        setOccurrence(data.event);
        setDateValue(getDateInputValue(data.event.date));
        setDescription(data.event.description || '');
      } catch (err) {
        console.error('[OccurrenceEditModal] load failed', err);
        if (!cancelled) {
          setError('load');
        }
        throw err;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [anniversaryId, occurrenceId, shouldLoad]);

  const onSave = async () => {
    if (!dateValue) {
      const err = new Error('Missing date');
      setError('missing-date');
      throw err;
    }
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/anniversaries/${anniversaryId}/events/${occurrenceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateValue, description }),
      });
      const refreshed = await apiFetch<{ event: OccurrenceForEdit }>(
        `/api/anniversaries/${anniversaryId}/events/${occurrenceId}`
      );
      setOccurrence(refreshed.event);
      onUpdated?.(refreshed.event);
      onClose();
    } catch (err) {
      console.error('[OccurrenceEditModal] save failed', err);
      setError('save');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3 max-w-md">
        <div>
          <label className="block mb-1 text-sm text-text">{t('date')}</label>
          <input
            type="date"
            className="border rounded w-full px-3 py-2"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm text-text">{t('description')}</label>
          <textarea
            className="border rounded w-full px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>
        {error && (
          <div className="text-red-600 text-sm">
            {(error === 'load' || error === 'save' || error === 'missing-date') && t('somethingWentWrong')}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            disabled={saving}
          >
            {t('close')}
          </Button>
          <Button
            onClick={async () => {
              try {
                await onSave();
              } catch (err) {
                throw err;
              }
            }}
            disabled={saving || loading}
          >
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
