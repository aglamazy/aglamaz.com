import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { ReminderTopic } from '@/services/ResendService';

export interface ReminderSendRecord {
  memberId: string;
  eventId: string;
  siteId: string;
  year: number;
  topic: ReminderTopic;
  sentAt: Timestamp;
}

export class ReminderSendsRepository {
  private readonly collection = 'reminderSends';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docId(memberId: string, eventId: string, year: number, topic: ReminderTopic): string {
    return `${memberId}_${eventId}_${year}_${topic}`;
  }

  async hasSent(memberId: string, eventId: string, year: number, topic: ReminderTopic): Promise<boolean> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(this.docId(memberId, eventId, year, topic)).get();
    return doc.exists;
  }

  async markSent(record: Omit<ReminderSendRecord, 'sentAt'>): Promise<void> {
    const db = this.getDb();
    const id = this.docId(record.memberId, record.eventId, record.year, record.topic);
    await db.collection(this.collection).doc(id).set({
      ...record,
      sentAt: Timestamp.now(),
    });
  }
}
