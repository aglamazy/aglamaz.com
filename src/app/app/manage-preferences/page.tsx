'use client';

import { useTranslation } from 'react-i18next';
import NotificationPreferences from '@/components/NotificationPreferences';

/**
 * Narrow, dedicated destination for the digest email's footer "manage preferences" link
 * (docs/family-digest-formats-spec.md §7) - just the notification-preferences controls, not
 * the full /app/profile page (which also renders EditUserDetails, a write-guarded form that
 * 401s for a read-only visitor). Reachable via the same `?rt=` read-only token as the
 * calendar/gallery links, so opening it from an inbox never hits a login wall.
 */
export default function ManagePreferencesPage() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex justify-center px-4 py-8" dir={i18n.dir()}>
      <div className="w-full max-w-md">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          {t('notifications')}
        </h1>
        <NotificationPreferences />
      </div>
    </div>
  );
}
