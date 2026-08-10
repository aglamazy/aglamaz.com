'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useSiteStore } from '@/store/SiteStore';
import { formatLocalizedDateTime } from '@/utils/dateFormat';
import type { ILoginAudit } from '@/repositories/LoginAuditRepository';
import type { EmailTrackingSendType } from '@/services/EmailTrackingService';

interface IEmailTrackingSendSummary {
  sendType: EmailTrackingSendType;
  sendId: string;
  sentCount: number | null;
  openedCount: number;
  clickedCount: number;
  lastEventAt: string;
}

interface IEmailTrackingRecipientDetail {
  memberId: string;
  displayLabel: string;
  email: string | null;
  opened: boolean;
  clicked: boolean;
  firstOpenAt: string | null;
  lastEventAt: string;
}

const SEND_TYPE_LABEL_KEYS: Record<EmailTrackingSendType, string> = {
  digest: 'sendTypeDigest',
  'in-day-reminder': 'sendTypeInDayReminders',
  'tag-notification': 'sendTypeTagNotification',
  'blessing-invite': 'sendTypeBlessingInvite',
  'blog-review-decision': 'sendTypeBlogReviewDecision',
  'blog-autogen-admin': 'sendTypeBlogAutogen',
};

function formatSendPeriod(sendId: string): string {
  const [cadence, periodKey] = sendId.split(':');
  return periodKey ? `${cadence}: ${periodKey}` : sendId;
}

type UsageDataTab = 'logins' | 'tracking';

export default function LoginAuditPage() {
  const { t, i18n } = useTranslation();
  const siteId = useSiteStore((s) => s.siteInfo?.id);
  const [activeTab, setActiveTab] = useState<UsageDataTab>('logins');
  const [entries, setEntries] = useState<ILoginAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailTracking, setEmailTracking] = useState<IEmailTrackingSendSummary[]>([]);
  const [emailTrackingLoading, setEmailTrackingLoading] = useState(true);
  const [emailTrackingError, setEmailTrackingError] = useState('');
  const [expandedSendKey, setExpandedSendKey] = useState<string | null>(null);
  const [recipientDetail, setRecipientDetail] = useState<Record<string, IEmailTrackingRecipientDetail[]>>({});
  const [recipientDetailLoading, setRecipientDetailLoading] = useState<Record<string, boolean>>({});
  const [recipientDetailError, setRecipientDetailError] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!siteId) return;
    apiFetch<{ sends: IEmailTrackingSendSummary[] }>(ApiRoute.SITE_EMAIL_TRACKING_SUMMARY, { pathParams: { siteId } })
      .then((data) => setEmailTracking(data.sends))
      .catch((err) => {
        console.error('[login-audit] failed to load email tracking summary', err);
        setEmailTrackingError(t('errorOccurred'));
      })
      .finally(() => setEmailTrackingLoading(false));
  }, [siteId, t]);

  const toggleSendDetail = (send: IEmailTrackingSendSummary) => {
    const key = `${send.sendType}:${send.sendId}`;
    if (expandedSendKey === key) {
      setExpandedSendKey(null);
      return;
    }
    setExpandedSendKey(key);
    if (!siteId || recipientDetail[key] || recipientDetailLoading[key]) return;
    setRecipientDetailLoading((prev) => ({ ...prev, [key]: true }));
    apiFetch<{ recipients: IEmailTrackingRecipientDetail[] }>(ApiRoute.SITE_EMAIL_TRACKING_DETAIL, {
      pathParams: { siteId },
      queryParams: { sendType: send.sendType, sendId: send.sendId },
    })
      .then((data) => setRecipientDetail((prev) => ({ ...prev, [key]: data.recipients })))
      .catch((err) => {
        console.error('[login-audit] failed to load recipient detail', err);
        setRecipientDetailError((prev) => ({ ...prev, [key]: t('errorOccurred') }));
      })
      .finally(() => setRecipientDetailLoading((prev) => ({ ...prev, [key]: false })));
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{t('loginAudit') || 'Usage Data'}</h1>

      <div className="flex gap-2 mb-4 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('logins')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'logins' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
          }`}
        >
          {t('loginAuditSectionTitle') || 'See who signed in, and when'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tracking')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'tracking' ? 'border-primary text-primary' : 'border-transparent text-gray-500'
          }`}
        >
          {t('emailTrackingSectionTitle') || 'Email opens and clicks'}
        </button>
      </div>

      {activeTab === 'logins' && (
        <>
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
        </>
      )}

      {activeTab === 'tracking' && (
        <>
          {emailTrackingLoading && <p>{t('loading')}</p>}
          {emailTrackingError && <p className="text-red-600">{emailTrackingError}</p>}
          {!emailTrackingLoading && !emailTrackingError && emailTracking.length === 0 && (
            <p className="text-gray-500">{t('noEmailTrackingEntries') || 'No email opens or clicks recorded yet.'}</p>
          )}
          {!emailTrackingLoading && emailTracking.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start">
                      <th className="p-3 text-start font-medium">{t('emailTrackingSendType') || 'Send type'}</th>
                      <th className="p-3 text-start font-medium">{t('emailTrackingPeriod') || 'Period'}</th>
                      <th className="p-3 text-start font-medium">{t('emailTrackingSent') || 'Sent'}</th>
                      <th className="p-3 text-start font-medium">{t('emailTrackingOpened') || 'Opened'}</th>
                      <th className="p-3 text-start font-medium">{t('emailTrackingClicked') || 'Clicked'}</th>
                      <th className="p-3 text-start font-medium">{t('emailTrackingLastEvent') || 'Last event'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailTracking.map((send) => {
                      const key = `${send.sendType}:${send.sendId}`;
                      const isExpanded = expandedSendKey === key;
                      const canDrillDown = send.openedCount > 0 || send.clickedCount > 0;
                      return (
                        <Fragment key={key}>
                          <tr
                            className={`border-b last:border-0 ${canDrillDown ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                            onClick={canDrillDown ? () => toggleSendDetail(send) : undefined}
                          >
                            <td className="p-3">{t(SEND_TYPE_LABEL_KEYS[send.sendType]) || send.sendType}</td>
                            <td className="p-3">{formatSendPeriod(send.sendId)}</td>
                            <td className="p-3">{send.sentCount ?? (t('emailTrackingSentUnknown') || '—')}</td>
                            <td className="p-3">{send.openedCount}</td>
                            <td className="p-3">{send.clickedCount}</td>
                            <td className="p-3">{formatLocalizedDateTime(send.lastEventAt, i18n.language)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b last:border-0 bg-gray-50">
                              <td colSpan={6} className="p-3">
                                {recipientDetailLoading[key] && <p>{t('loading')}</p>}
                                {recipientDetailError[key] && <p className="text-red-600">{recipientDetailError[key]}</p>}
                                {!recipientDetailLoading[key] && !recipientDetailError[key] && (recipientDetail[key]?.length ?? 0) === 0 && (
                                  <p className="text-gray-500">{t('emailTrackingNoRecipientDetail') || 'No individual engagement recorded yet.'}</p>
                                )}
                                {!recipientDetailLoading[key] && (recipientDetail[key]?.length ?? 0) > 0 && (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b text-start">
                                        <th className="p-2 text-start font-medium">{t('emailTrackingRecipient') || 'Recipient'}</th>
                                        <th className="p-2 text-start font-medium">{t('emailTrackingOpened') || 'Opened'}</th>
                                        <th className="p-2 text-start font-medium">{t('emailTrackingClicked') || 'Clicked'}</th>
                                        <th className="p-2 text-start font-medium">{t('emailTrackingLastEvent') || 'Last event'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {recipientDetail[key]!.map((recipient) => (
                                        <tr key={recipient.memberId} className="border-b last:border-0">
                                          <td className="p-2">{recipient.displayLabel}</td>
                                          <td className="p-2">{recipient.opened ? '✓' : ''}</td>
                                          <td className="p-2">{recipient.clicked ? '✓' : ''}</td>
                                          <td className="p-2">{formatLocalizedDateTime(recipient.lastEventAt, i18n.language)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
