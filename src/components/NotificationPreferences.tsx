'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';

type MagazineCadence = 'weekly' | 'monthly' | 'none';

interface PreferencesPayload {
  magazineCadence: MagazineCadence;
  inDayRemindersEnabled: boolean;
}

const DEFAULT_PREFERENCES: PreferencesPayload = {
  magazineCadence: 'monthly',
  inDayRemindersEnabled: true,
};

function normalizePreferences(payload: Partial<PreferencesPayload>): PreferencesPayload {
  return {
    magazineCadence:
      payload.magazineCadence === 'weekly' || payload.magazineCadence === 'monthly' || payload.magazineCadence === 'none'
        ? payload.magazineCadence
        : DEFAULT_PREFERENCES.magazineCadence,
    inDayRemindersEnabled:
      typeof payload.inDayRemindersEnabled === 'boolean'
        ? payload.inDayRemindersEnabled
        : DEFAULT_PREFERENCES.inDayRemindersEnabled,
  };
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

// A native checkbox at the leading edge of the row - relies on normal document
// flow (not a manual translate-x) so it lands on the correct side under both
// dir="ltr" and dir="rtl" without special-casing. The prior custom toggle
// switch hardcoded its knob's translate-x direction, which looked broken
// under Hebrew's RTL layout.
function CheckboxRow({ id, label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-sage-600 focus:ring-sage-600 disabled:opacity-50"
      />
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </label>
    </div>
  );
}

export default function NotificationPreferences() {
  const { t, i18n } = useTranslation();
  const [preferences, setPreferences] = useState<PreferencesPayload>(DEFAULT_PREFERENCES);
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
        setPreferences(normalizePreferences(payload));
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

  const applyUpdate = async (
    field: keyof PreferencesPayload,
    value: PreferencesPayload[typeof field],
  ) => {
    const previous = preferences;
    setPreferences({ ...preferences, [field]: value });
    setPendingField(field);
    setError('');
    try {
      const { preferences: updated } = await apiFetch<{ preferences: PreferencesPayload }>(
        ApiRoute.SITE_NOTIFICATION_PREFERENCES,
        {
          method: 'PUT',
          body: { [field]: value },
        },
      );
      setPreferences(normalizePreferences(updated));
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
        <div className="py-3 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label htmlFor="magazineCadence" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('notificationsMagazineLabel')}
              </label>
              <span className="block text-xs text-gray-500">{t('notificationsMagazineDescription')}</span>
            </div>
            <select
              id="magazineCadence"
              value={preferences.magazineCadence}
              disabled={loading || pendingField === 'magazineCadence'}
              onChange={(e) => void applyUpdate('magazineCadence', e.target.value as MagazineCadence)}
              className="min-w-32 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm disabled:opacity-50"
            >
              <option value="weekly">{t('notificationsMagazineCadenceWeekly')}</option>
              <option value="monthly">{t('notificationsMagazineCadenceMonthly')}</option>
              <option value="none">{t('none')}</option>
            </select>
          </div>
        </div>
        <CheckboxRow
          id="inDayRemindersEnabled"
          label={t('notificationsInDayRemindersLabel')}
          description={t('notificationsInDayRemindersDescription')}
          checked={preferences.inDayRemindersEnabled}
          disabled={loading || pendingField === 'inDayRemindersEnabled'}
          onChange={(checked) => void applyUpdate('inDayRemindersEnabled', checked)}
        />
      </div>
    </div>
  );
}
