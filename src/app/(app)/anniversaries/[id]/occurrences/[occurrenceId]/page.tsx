"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import { apiFetch } from '@/utils/apiFetch';

interface OccurrenceDoc {
  id: string;
  siteId: string;
  eventId: string;
  date: any;
}

interface EventDoc {
  id: string;
  name: string;
}

export default function OccurrenceDetailsPage({ params }: { params: { id: string; occurrenceId: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [occ, setOcc] = useState<OccurrenceDoc | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const ae = await apiFetch<{ event: { id: string; name: string } }>(
          `/api/anniversaries/${params.id}`
        );
        const bo = await apiFetch<{ occurrence: { id: string; date: any } }>(
          `/api/anniversaries/${params.id}/occurrences/${params.occurrenceId}`
        );
        if (!mounted) return;
        setEvent(ae.event as any);
        setOcc(bo.occurrence as any);
      } catch (e) {
        console.error(e);
        if (mounted) setError('load');
        throw e;
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [params.id, params.occurrenceId]);

  if (loading) {
    return (
      <div className="p-4">
        <I18nText k="loading" />
      </div>
    );
  }
  if (error || !event || !occ) {
    return (
      <div className="p-4">
        <I18nText k="somethingWentWrong" />
      </div>
    );
  }

  const raw = occ.date as any;
  const d = raw?.toDate
    ? raw.toDate()
    : typeof raw?._seconds === 'number'
      ? new Date(raw._seconds * 1000)
      : typeof raw?.seconds === 'number'
        ? new Date(raw.seconds * 1000)
        : new Date(raw);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const dateText = `${dd}/${mm}/${yyyy}`;

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-700">
          <div className="mb-2">
            <span className="font-medium"><I18nText k="date" />:</span> {dateText}
          </div>
          <div>
            <a className="text-blue-600 hover:underline" href="/calendar">
              <I18nText k="familyCalendar" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
