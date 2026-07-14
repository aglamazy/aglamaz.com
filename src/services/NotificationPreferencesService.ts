import type { ReminderTopic } from '@/repositories/ReminderRepository';

/**
 * TODO(famcircle#11): replace with a real lookup against the `notificationPreferences` data
 * model once it lands (intended shape per docs/notifications-reminders-spec.md:
 * { memberId, siteId, birthOptOut, deathOptOut, updatedAt }, doc-scoped under the member).
 * No preference doc present = subscribed to both (the documented default), so until #11
 * ships this stub always reports "not opted out".
 */
export async function isOptedOut(
  _memberId: string,
  _siteId: string,
  _topic: ReminderTopic
): Promise<boolean> {
  return false;
}
