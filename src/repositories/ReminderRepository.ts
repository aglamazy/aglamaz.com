import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export type ReminderTopic = 'birth' | 'death';

export interface ReminderSend {
  id: string;
  memberId: string;
  siteId: string;
  anniversaryEventId: string;
  topic: ReminderTopic;
  occurrenceYear: number;
  sentAt: Timestamp;
}

/** Deterministic dedup key - one send per (member, event, occurrence year, topic). Mirrors docs/notifications-reminders-spec.md. */
export function reminderSendId(
  memberId: string,
  anniversaryEventId: string,
  occurrenceYear: number,
  topic: ReminderTopic
): string {
  return `${memberId}_${anniversaryEventId}_${occurrenceYear}_${topic}`;
}

export class ReminderRepository {
  private readonly collection = 'reminderSends';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async hasSent(id: string): Promise<boolean> {
    const doc = await this.getDb().collection(this.collection).doc(id).get();
    return doc.exists;
  }

  async recordSent(data: Omit<ReminderSend, 'sentAt'>): Promise<void> {
    await this.getDb().collection(this.collection).doc(data.id).set({
      ...data,
      sentAt: Timestamp.now(),
    });
  }
}
