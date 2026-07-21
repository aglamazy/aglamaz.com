'use client';

// TEMPORARY - for composing the digest email template live against real site data
// (Agla, 2026-07-21). Remove (page + nav link + the /api/dev/digest-preview route)
// once the format is settled.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';

export default function DigestPreviewPage() {
  const { t } = useTranslation();
  const siteInfo = useSiteStore((s) => s.siteInfo);
  const [cadence, setCadence] = useState<'monthly' | 'weekly'>('monthly');

  return (
    <div className="container mx-auto px-2 py-4">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-xl font-bold">{t('digestPreview')}</h1>
        <div className="flex rounded-full overflow-hidden border border-gray-300">
          <button
            onClick={() => setCadence('monthly')}
            className={`px-3 py-1 text-sm ${cadence === 'monthly' ? 'bg-sage-600 text-white' : 'bg-white'}`}
          >
            {t('notificationsMagazineCadenceMonthly')}
          </button>
          <button
            onClick={() => setCadence('weekly')}
            className={`px-3 py-1 text-sm ${cadence === 'weekly' ? 'bg-sage-600 text-white' : 'bg-white'}`}
          >
            {t('notificationsMagazineCadenceWeekly')}
          </button>
        </div>
      </div>
      {/* The digest is a standalone HTML email document (own <html>/<head>/styles) -
          an iframe keeps it visually isolated from the app's own page chrome, same
          as how it'll actually render inside an email client. */}
      {siteInfo?.id && (
        <iframe
          key={cadence}
          src={`/api/site/${siteInfo.id}/dev/digest-preview?cadence=${cadence}`}
          title={t('digestPreview') as string}
          className="w-full border rounded-lg"
          style={{ height: '80vh' }}
        />
      )}
    </div>
  );
}
