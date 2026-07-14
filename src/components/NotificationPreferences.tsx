'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';

interface PreferencesPayload {
  birthOptOut: boolean;
  deathOptOut: boolean;
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ id, label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <span className="block text-xs text-gray-500">{description}</span>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-sage-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationPreferences() {
  const { t, i18n } = useTranslation();
  const [preferences, setPreferences] = useState<PreferencesPayload>({ birthOptOut: false, deathOptOut: false });
  const [loading, setLoading] = useState(true);
  const [pendingField, setPendingField] = useState<keyof PreferencesPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void apiFetch<{ preferences: PreferencesPayload }>(ApiRoute.SITE_NOTIFICATION_PREFERENCES)
      .then(({ preferences: payload }) => {
        if (cancelled) return;
        setPreferences({ birthOptOut: !!payload.birthOptOut, deathOptOut: !!payload.deathOptOut });
      })
      .catch((err) => {
        console.error('[notification-preferences] failed to load preferences', err);
        if (!cancelled) {
          setError(t('failedToLoadNotificationPreferences'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (field: keyof PreferencesPayload, subscribed: boolean) => {
    const optOut = !subscribed;
    const previous = preferences;
    setPreferences({ ...preferences, [field]: optOut });
    setPendingField(field);
    setError('');
    try {
      const { preferences: updated } = await apiFetch<{ preferences: PreferencesPayload }>(
        ApiRoute.SITE_NOTIFICATION_PREFERENCES,
        {
          method: 'PUT',
          body: { [field]: optOut },
        },
      );
      setPreferences({ birthOptOut: !!updated.birthOptOut, deathOptOut: !!updated.deathOptOut });
    } catch (err) {
      console.error('[notification-preferences] failed to update preferences', err);
      setPreferences(previous);
      setError(t('failedToUpdateNotificationPreferences'));
    } finally {
      setPendingField(null);
    }
  };

  return (
    <div className="w-full max-w-md mt-6" dir={i18n.dir()} lang={i18n.language}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('notifications')}</h2>
      {error && (
        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        <ToggleRow
          id="birthdayReminders"
          label={t('birthdayReminders')}
          description={t('birthdayRemindersDescription')}
          checked={!preferences.birthOptOut}
          disabled={loading || pendingField === 'birthOptOut'}
          onChange={(subscribed) => void handleToggle('birthOptOut', subscribed)}
        />
        <ToggleRow
          id="yahrzeitReminders"
          label={t('yahrzeitReminders')}
          description={t('yahrzeitRemindersDescription')}
          checked={!preferences.deathOptOut}
          disabled={loading || pendingField === 'deathOptOut'}
          onChange={(subscribed) => void handleToggle('deathOptOut', subscribed)}
        />
      </div>
    </div>
  );
}
