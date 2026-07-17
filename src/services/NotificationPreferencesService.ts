import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import type { ReminderTopic } from '@/repositories/ReminderRepository';

export async function isOptedOut(
  memberId: string,
  siteId: string,
  topic: ReminderTopic
): Promise<boolean> {
  const prefs = await notificationPreferencesRepository.get(memberId, siteId);
  if (topic === 'birth') return prefs.birthOptOut;
  if (topic === 'death') return prefs.deathOptOut;
  return false;
}
