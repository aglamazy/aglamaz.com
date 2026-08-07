'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useSiteStore } from '@/store/SiteStore';
import { formatLocalizedDateTime } from '@/utils/dateFormat';
import type { ILoginAudit } from '@/repositories/LoginAuditRepository';
import type { DigestCadence } from '@/repositories/DigestSendRepository';

interface DigestUsageRow {
  cadence: DigestCadence;
  periodKey: string;
  sent: number;
  opened: number;
  clicked: number;
}

export default function UsageDataPage() {
  const { t, i18n } = useTranslation();
  const siteId = useSiteStore((s) => s.siteInfo?.id);
  const [entries, setEntries] = useState<ILoginAudit[]>([]);
  const [digestUsage, setDigestUsage] = useState<DigestUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteId) return;
    apiFetch<{ entries: ILoginAudit[]; digestUsage: DigestUsageRow[] }>(ApiRoute.SITE_LOGIN_AUDIT, { pathParams: { siteId } })
      .then((data) => {
        setEntries(data.entries);
        setDigestUsage(data.digestUsage);
      })
      .catch((err) => {
        console.error('[usage-data] failed to load', err);
        setError(t('errorOccurred'));
      })
      .finally(() => setLoading(false));
  }, [siteId, t]);

  const cadenceLabel = (cadence: DigestCadence) =>
    cadence === 'weekly'
      ? t('notificationsMagazineCadenceWeekly') || 'Weekly'
      : t('notificationsMagazineCadenceMonthly') || 'Monthly';

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">{t('usageData') || 'Usage Data'}</h1>
        <p className="text-sm text-gray-500">{t('usageDataDescription') || 'See who signed in, and who opened the emails'}</p>
      </div>
      {loading && <p>{t('loading')}</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('loginAudit') || 'Login Audit'}</CardTitle>
              <p className="text-sm text-gray-500">{t('viewLoginAudit') || 'See who signed in, and when'}</p>
            </CardHeader>
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <p className="text-gray-500 px-6 pb-6">{t('noLoginAuditEntries') || 'No logins recorded yet.'}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start">
                      <th className="p-3 text-start font-medium">{t('email')}</th>
                      <th className="p-3 text-start font-medium">{t('loginAuditProvider') || 'Provider'}</th>
                      <th className="p-3 text-start font-medium">{t('loginAuditWhen') || 'When'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="p-3">{entry.email}</td>
                        <td className="p-3">{entry.provider}</td>
                        <td className="p-3">{formatLocalizedDateTime(entry.createdAt, i18n.language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('emailOpensTitle') || 'Email Opens'}</CardTitle>
              <p className="text-sm text-gray-500">
                {t('emailOpensDescription') || 'Digest sends and how many recipients opened or clicked, by period'}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {digestUsage.length === 0 ? (
                <p className="text-gray-500 px-6 pb-6">{t('noDigestUsageEntries') || 'No digest sends recorded yet.'}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start">
                      <th className="p-3 text-start font-medium">{t('usageDigestCadence') || 'Cadence'}</th>
                      <th className="p-3 text-start font-medium">{t('usageDigestPeriod') || 'Period'}</th>
                      <th className="p-3 text-start font-medium">{t('usageDigestSent') || 'Sent'}</th>
                      <th className="p-3 text-start font-medium">{t('usageDigestOpened') || 'Opened'}</th>
                      <th className="p-3 text-start font-medium">{t('usageDigestClicked') || 'Clicked'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {digestUsage.map((row) => (
                      <tr key={`${row.cadence}:${row.periodKey}`} className="border-b last:border-0">
                        <td className="p-3">{cadenceLabel(row.cadence)}</td>
                        <td className="p-3">{row.periodKey}</td>
                        <td className="p-3">{row.sent}</td>
                        <td className="p-3">{row.opened}</td>
                        <td className="p-3">{row.clicked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
