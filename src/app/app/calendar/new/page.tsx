'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import EventFormContent from '@/components/calendar/EventFormContent';

export default function NewCalendarEventPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-semibold">{t('addEvent') || 'Add Event'}</h1>
        <button
          onClick={() => router.back()}
          className="p-1 hover:bg-gray-100 rounded-full"
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 max-w-2xl mx-auto pb-24">
        <EventFormContent
          onSuccess={() => router.push('/app/calendar')}
        />
      </div>
    </div>
  );
}
