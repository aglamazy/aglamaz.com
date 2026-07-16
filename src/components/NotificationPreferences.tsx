'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useSiteStore } from '@/store/SiteStore';

interface NotifPrefs {
  magazineOptOut: boolean;
}

export default function NotificationPreferences() {
  const { t } = useTranslation();
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteInfo?.id || siteInfo.id === '__SITE_INFO__') return;
    setLoading(true);
    setError('');
    void apiFetch<{ prefs: NotifPrefs }>(ApiRoute.SITE_NOTIFICATION_PREFERENCES)
      .then(({ prefs: loaded }) => setPrefs(loaded))
      .catch(() => setError(t('failedToLoadPreferences', { defaultValue: 'Failed to load preferences' })))
      .finally(() => setLoading(false));
  }, [siteInfo?.id]);

  const handleMagazineToggle = async () => {
    if (!prefs || saving) return;
    const next = !prefs.magazineOptOut;
    setSaving(true);
    setError('');
    try {
      const { prefs: updated } = await apiFetch<{ prefs: NotifPrefs }>(
        ApiRoute.SITE_NOTIFICATION_PREFERENCES,
        { method: 'PUT', body: { magazineOptOut: next } },
      );
      setPrefs(updated);
    } catch {
      setError(t('failedToSavePreferences', { defaultValue: 'Failed to save preferences' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 py-4">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  const subscribed = prefs ? !prefs.magazineOptOut : true;

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {t('notificationPreferences', { defaultValue: 'Notification Preferences' })}
      </h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {t('monthlyMagazine', { defaultValue: 'Monthly Family Magazine' })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('monthlyMagazineDescription', { defaultValue: 'Receive the monthly family digest by email' })}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={subscribed}
          onClick={() => { void handleMagazineToggle(); }}
          disabled={saving}
          className={[
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2',
            'disabled:opacity-50',
            subscribed ? 'bg-sage-600' : 'bg-gray-200 dark:bg-gray-600',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
              'transition duration-200 ease-in-out',
              subscribed ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}
