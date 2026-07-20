import type { Timestamp } from 'firebase-admin/firestore';

export type MagazineCadence = 'weekly' | 'monthly';

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
  magazineEnabled: boolean;
  magazineCadence: MagazineCadence;
  inDayRemindersEnabled: boolean;
  updatedAt?: Timestamp;
}

export const DEFAULT_PREFERENCES = {
  magazineEnabled: true,
  magazineCadence: 'monthly' as MagazineCadence,
  inDayRemindersEnabled: true,
} as const;

export function normalizeCadence(value: unknown): MagazineCadence {
  return value === 'weekly' || value === 'monthly' ? value : DEFAULT_PREFERENCES.magazineCadence;
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
    magazineEnabled: typeof data?.magazineEnabled === 'boolean' ? data.magazineEnabled : DEFAULT_PREFERENCES.magazineEnabled,
    magazineCadence: normalizeCadence(data?.magazineCadence),
    inDayRemindersEnabled:
      typeof data?.inDayRemindersEnabled === 'boolean'
        ? data.inDayRemindersEnabled
        : DEFAULT_PREFERENCES.inDayRemindersEnabled,
    updatedAt: data?.updatedAt as Timestamp | undefined,
  };
}
