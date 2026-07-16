"use client";

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemberStore } from '@/store/MemberStore';
import { useUserStore } from '@/store/UserStore';
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';

// Houses on-site notification preference toggles. Today this covers the
// monthly magazine only (famcircle#24); birth/death reminder opt-out
// (famcircle#11) lands here once its own field/collection is built.
export default function NotificationPreferences() {
  const { t } = useTranslation();
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const memberLoading = useMemberStore((state) => state.loading);
  const { user } = useUserStore();
  const site = useSiteStore((state) => state.siteInfo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!requested && user?.user_id && site?.id) {
      setRequested(true);
      fetchMember(user.user_id, site.id);
    }
  }, [fetchMember, requested, site?.id, user?.user_id]);

  const toggleMagazine = useCallback(async (optOut: boolean) => {
    if (!user?.user_id || !site?.id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(ApiRoute.USER_MAGAZINE_OPT_OUT, {
        method: 'POST',
        pathParams: { userId: user.user_id },
        queryParams: { siteId: site.id },
        body: { optOut },
      });
      await fetchMember(user.user_id, site.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update notification settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [fetchMember, site?.id, user?.user_id]);

  const magazineOptedOut = Boolean(member?.magazineOptOut);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('notificationPreferencesTitle', { defaultValue: 'Notification preferences' })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            {t('magazinePreferenceLabel', { defaultValue: 'Monthly email magazine' })}
          </div>
          <div className="text-sm text-gray-600">
            {magazineOptedOut
              ? t('magazineStatusOptedOut', { defaultValue: 'You are not receiving the monthly magazine.' })
              : t('magazineStatusSubscribed', { defaultValue: 'You are receiving the monthly magazine.' })}
          </div>
          <button
            type="button"
            onClick={() => toggleMagazine(!magazineOptedOut)}
            disabled={saving || memberLoading}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving
              ? t('saving')
              : magazineOptedOut
                ? t('resubscribeMagazine', { defaultValue: 'Resubscribe to magazine' })
                : t('unsubscribeMagazine', { defaultValue: 'Unsubscribe from magazine' })}
          </button>
          <p className="text-xs text-gray-500">
            {t('magazineUnsubscribeHint', {
              defaultValue: 'You can also unsubscribe from the link at the bottom of any magazine email.',
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
