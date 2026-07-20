import type { Timestamp } from 'firebase-admin/firestore';

export type MagazineCadence = 'weekly' | 'monthly' | 'none';

/**
 * NotificationPreferences (see docs/family-digest-formats-spec.md §4).
 *
 * Replaces the retired { birthOptOut, deathOptOut } shape. Old-shape docs (if any) are read
 * back as the documented defaults below rather than translated field-by-field — the old
 * per-topic opt-outs have no clean 1:1 mapping onto the new unified toggles.
 *
 * magazineCadence is the ONLY magazine control - 'none' IS the off state (revised 2026-07-20,
 * spec §4). There is no separate magazineEnabled boolean: a doc written by the earlier
 * (corrected) implementation with magazineEnabled === false is read back as cadence 'none'
 * regardless of whatever magazineCadence value sits next to it, so no data is silently lost.
 */
export interface NotificationPreferences {
  memberId: string;
  siteId: string;
  magazineCadence: MagazineCadence;
  inDayRemindersEnabled: boolean;
  updatedAt?: Timestamp;
}

export const DEFAULT_PREFERENCES = {
  magazineCadence: 'monthly' as MagazineCadence,
  inDayRemindersEnabled: true,
} as const;

export function normalizeCadence(value: unknown): MagazineCadence {
  return value === 'weekly' || value === 'monthly' || value === 'none' ? value : DEFAULT_PREFERENCES.magazineCadence;
}

/** Maps a raw Firestore doc (old shape, the retired magazineEnabled+magazineCadence shape, or
 * current shape) onto the current single-field shape. */
export function normalizePreferences(
  memberId: string,
  siteId: string,
  data: Record<string, unknown> | undefined,
): NotificationPreferences {
  const magazineCadence = data?.magazineEnabled === false ? 'none' : normalizeCadence(data?.magazineCadence);

  return {
    memberId,
    siteId,
    magazineCadence,
    inDayRemindersEnabled:
      typeof data?.inDayRemindersEnabled === 'boolean'
        ? data.inDayRemindersEnabled
        : DEFAULT_PREFERENCES.inDayRemindersEnabled,
    updatedAt: data?.updatedAt as Timestamp | undefined,
  };
}
