import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export type WhatsAppTopic = 'yahrzeit_wa';

export interface WhatsAppSendRecord {
  memberId: string;
  eventId: string;
  siteId: string;
  year: number;
  topic: WhatsAppTopic;
  sentAt: Timestamp;
}

export class WhatsAppSendsRepository {
  private readonly collection = 'whatsappSends';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docId(memberId: string, eventId: string, year: number, topic: WhatsAppTopic): string {
    return `${memberId}_${eventId}_${year}_${topic}`;
  }

  async hasSent(memberId: string, eventId: string, year: number, topic: WhatsAppTopic): Promise<boolean> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(this.docId(memberId, eventId, year, topic)).get();
    return doc.exists;
  }

  async markSent(record: Omit<WhatsAppSendRecord, 'sentAt'>): Promise<void> {
    const db = this.getDb();
    const id = this.docId(record.memberId, record.eventId, record.year, record.topic);
    await db.collection(this.collection).doc(id).set({
      ...record,
      sentAt: Timestamp.now(),
    });
  }
}
