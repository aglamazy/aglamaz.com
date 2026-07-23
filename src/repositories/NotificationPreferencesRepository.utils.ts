import type { Timestamp } from 'firebase-admin/firestore';

export type MagazineCadence = 'weekly' | 'monthly';
export type UnifiedMagazineCadence = MagazineCadence | 'none';

/**
 * NotificationPreferences (see docs/family-digest-formats-spec.md §4).
 *
 * Replaces the retired { birthOptOut, deathOptOut } shape. Old-shape docs (if any) are read
 * back as the documented defaults below rather than translated field-by-field — the old
 * per-topic opt-outs have no clean 1:1 mapping onto the new unified toggles.
 */
export interface NotificationPreferences {
  memberId: string;
  siteId: string;
  magazineCadence: UnifiedMagazineCadence;
  inDayRemindersEnabled: boolean;
  updatedAt?: Timestamp;
}

export const DEFAULT_PREFERENCES = {
  magazineCadence: 'weekly' as MagazineCadence,
  inDayRemindersEnabled: true,
} as const;

const LEGACY_MAGAZINE_ENABLED_FIELD = ['magazine', 'Enabled'].join('');

export function normalizeCadence(value: unknown): UnifiedMagazineCadence {
  if (value === 'weekly' || value === 'monthly' || value === 'none') {
    return value;
  }
  return DEFAULT_PREFERENCES.magazineCadence;
}

function normalizeLegacyMagazineCadence(data: Record<string, unknown> | undefined): UnifiedMagazineCadence {
  const legacyEnabled = data?.[LEGACY_MAGAZINE_ENABLED_FIELD];
  if (typeof legacyEnabled === 'boolean' && !legacyEnabled) {
    return 'none';
  }

  const cadence = normalizeCadence(data?.magazineCadence);
  if (data?.magazineCadence === 'none') {
    return cadence;
  }
  if (cadence !== DEFAULT_PREFERENCES.magazineCadence) {
    return cadence;
  }
  if (typeof legacyEnabled === 'boolean' && legacyEnabled) {
    return cadence;
  }
  return DEFAULT_PREFERENCES.magazineCadence;
}

/** Maps a raw Firestore doc (old or new shape, or partially-populated) onto the current shape. */
export function normalizePreferences(
  memberId: string,
  siteId: string,
  data: Record<string, unknown> | undefined,
): NotificationPreferences {
  return {
    memberId,
    siteId,
    magazineCadence: normalizeLegacyMagazineCadence(data),
    inDayRemindersEnabled:
      typeof data?.inDayRemindersEnabled === 'boolean'
        ? data.inDayRemindersEnabled
        : DEFAULT_PREFERENCES.inDayRemindersEnabled,
    updatedAt: data?.updatedAt as Timestamp | undefined,
  };
}
