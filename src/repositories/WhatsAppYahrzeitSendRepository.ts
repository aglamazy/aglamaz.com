import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface WhatsAppYahrzeitSendRecord {
  siteId: string;
  eventId: string;
  year: number;
  locale: string;
  message: string;
  sentAt: Timestamp;
}

export class WhatsAppYahrzeitSendRepository {
  private readonly collection = 'whatsappYahrzeitSends';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docId(siteId: string, eventId: string, year: number): string {
    return `${siteId}_${eventId}_${year}`;
  }

  async hasSent(siteId: string, eventId: string, year: number): Promise<boolean> {
    const db = this.getDb();
    const snap = await db.collection(this.collection).doc(this.docId(siteId, eventId, year)).get();
    return snap.exists;
  }

  async markSent(record: Omit<WhatsAppYahrzeitSendRecord, 'sentAt'>): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(this.docId(record.siteId, record.eventId, record.year)).set({
      ...record,
      sentAt: Timestamp.now(),
    });
  }
}
