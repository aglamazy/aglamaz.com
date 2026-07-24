'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useSiteStore } from '@/store/SiteStore';
import { formatLocalizedDateTime } from '@/utils/dateFormat';
import type { ILoginAudit } from '@/repositories/LoginAuditRepository';

export default function LoginAuditPage() {
  const { t, i18n } = useTranslation();
  const siteId = useSiteStore((s) => s.siteInfo?.id);
  const [entries, setEntries] = useState<ILoginAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteId) return;
    apiFetch<{ entries: ILoginAudit[] }>(ApiRoute.SITE_LOGIN_AUDIT, { pathParams: { siteId } })
      .then((data) => setEntries(data.entries))
      .catch((err) => {
        console.error('[login-audit] failed to load', err);
        setError(t('errorOccurred'));
      })
      .finally(() => setLoading(false));
  }, [siteId, t]);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{t('loginAudit') || 'Login Audit'}</h1>
      {loading && <p>{t('loading')}</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="text-gray-500">{t('noLoginAuditEntries') || 'No logins recorded yet.'}</p>
      )}
      {!loading && entries.length > 0 && (
        <Card>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
