import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import type { ReminderTopic } from '@/repositories/ReminderRepository';

// The new preference model (docs/family-digest-formats-spec.md §4) has a single unified
// inDayRemindersEnabled toggle — no per-topic opt-out — so every ReminderTopic maps to it.
export async function isOptedOut(
  memberId: string,
  siteId: string,
  _topic: ReminderTopic
): Promise<boolean> {
  const prefs = await notificationPreferencesRepository.get(memberId, siteId);
  return !prefs.inDayRemindersEnabled;
}
