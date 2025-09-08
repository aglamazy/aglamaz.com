"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';

export default function NewOccurrencePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params?.id || '';
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await apiFetch<{ occurrence: { id: string } }>(
        `/api/anniversaries/${eventId}/occurrences`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        }
      );
      const id = data?.occurrence?.id;
      if (!id) throw new Error('Invalid response: missing id');
      router.push(`/anniversaries/${eventId}/occurrences/${id}`);
      return true;
    } catch (err) {
      console.error(err);
      setError(t('errorOccurred'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t('newOccurrence')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-text">{t('date')}</label>
            <input
              type="date"
              className="border rounded w-full px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
