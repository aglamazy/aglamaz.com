"use client";

// F7-A (famcircle#119): the one admin page every site admin uses to see + control every
// send type the system fires (digest, in-day reminders, yahrzeit WhatsApp, AI blog draft).
// The on/off column here is read literally by the 4 cron routes via
// SiteRepository.resolveSendSettings - no shadow config, what you toggle is what fires.
// Locale column is a reserved placeholder only (Agla, 2026-07-30: locale handled after
// these sends land - do not build the behavior yet).
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';
import type { SendType } from '@/entities/Site';

interface SendTypeRow {
  type: SendType;
  enabled: boolean;
}

const ROW_LABEL_KEY: Record<SendType, string> = {
  digest: 'sendTypeDigest',
  inDayReminders: 'sendTypeInDayReminders',
  yahrzeitWhatsapp: 'sendTypeYahrzeitWhatsapp',
  blogAutogen: 'sendTypeBlogAutogen',
};

const ROW_RECIPIENTS_KEY: Record<SendType, string> = {
  digest: 'sendTypeDigestRecipients',
  inDayReminders: 'sendTypeInDayRemindersRecipients',
  yahrzeitWhatsapp: 'sendTypeYahrzeitWhatsappRecipients',
  blogAutogen: 'sendTypeBlogAutogenRecipients',
};

export default function SendSettingsPage() {
  const { t } = useTranslation();
  const site = useSiteStore(state => state.siteInfo);
  const [rows, setRows] = useState<SendTypeRow[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savingType, setSavingType] = useState<SendType | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!site?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await apiFetch<{ sendTypes: SendTypeRow[] }>(ApiRoute.SITE_SEND_SETTINGS);
        if (!cancelled) {
          setRows(result.sendTypes);
        }
      } catch (err) {
        console.error('[admin/send-settings] failed to load', err);
        if (!cancelled) {
          setLoadError(t('sendSettingsLoadError') || 'Failed to load send settings');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [site?.id, t]);

  const handleToggle = async (type: SendType, nextEnabled: boolean) => {
    setSavingType(type);
    setSaveError('');
    const previous = rows;
    setRows((current) => current?.map((row) => (row.type === type ? { ...row, enabled: nextEnabled } : row)) ?? current);
    try {
      const result = await apiFetch<{ sendTypes: SendTypeRow[] }>(ApiRoute.SITE_SEND_SETTINGS, {
        method: 'POST',
        body: { type, enabled: nextEnabled },
      });
      setRows(result.sendTypes);
    } catch (err) {
      console.error('[admin/send-settings] failed to save', err);
      setRows(previous ?? null);
      setSaveError(t('sendSettingsSaveError') || 'Failed to update');
    } finally {
      setSavingType(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('sendSettingsTitle') || 'Sends control'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-sage-600">
            {t('sendSettingsSubtitle') ||
              "Every automated send this site can fire, and whether it's on. This is exactly what each scheduled job checks before sending - toggle one off and it skips, no separate switch anywhere else."}
          </p>

          {loadError && <p className="text-red-600 text-sm">{loadError}</p>}
          {saveError && <p className="text-red-600 text-sm">{saveError}</p>}

          {!rows && !loadError && (
            <div className="flex items-center gap-2 text-sage-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('loading') || 'Loading...'}
            </div>
          )}

          {rows && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sage-200 text-sm text-sage-600">
                    <th className="py-2 pr-4">{t('sendSettingsColumnType') || 'Send type'}</th>
                    <th className="py-2 pr-4">{t('sendSettingsColumnStatus') || 'Status'}</th>
                    <th className="py-2 pr-4">{t('sendSettingsColumnRecipients') || 'Recipients'}</th>
                    <th className="py-2 pr-4 text-sage-400">{t('sendSettingsColumnLocale') || 'Locale'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.type} className="border-b border-sage-100">
                      <td className="py-3 pr-4 font-medium text-charcoal">
                        {t(ROW_LABEL_KEY[row.type]) || row.type}
                      </td>
                      <td className="py-3 pr-4">
                        <Button
                          onClick={() => handleToggle(row.type, !row.enabled)}
                          disabled={savingType === row.type}
                          variant={row.enabled ? 'primary' : 'outline'}
                          className="min-w-[5.5rem] justify-center"
                        >
                          {savingType === row.type ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : row.enabled ? (
                            t('sendSettingsOn') || 'On'
                          ) : (
                            t('sendSettingsOff') || 'Off'
                          )}
                        </Button>
                      </td>
                      <td className="py-3 pr-4 text-sm text-sage-600">
                        {t(ROW_RECIPIENTS_KEY[row.type]) || ''}
                      </td>
                      {/* Reserved for locale-per-send-type (Agla 2026-07-30) - visually
                          present, non-functional until that lands. */}
                      <td className="py-3 pr-4 text-sm text-sage-400 italic">
                        {t('sendSettingsLocaleReserved') || 'Coming soon'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
