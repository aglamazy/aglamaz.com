import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import type { AnniversaryEvent } from '@/entities/Anniversary';

export class AnniversaryRepository {
  private readonly collection = 'anniversaries';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(eventData: {
    siteId: string;
    name: string;
    description?: string;
    type: 'birthday' | 'death' | 'wedding';
    date: Date;
    isAnnual: boolean;
    createdBy: string;
  }): Promise<AnniversaryEvent> {
    const db = this.getDb();
    const now = Timestamp.now();
    const eventDate = Timestamp.fromDate(eventData.date);
    const ref = await db.collection(this.collection).add({
      siteId: eventData.siteId,
      name: eventData.name,
      description: eventData.description || '',
      type: eventData.type,
      date: eventDate,
      month: eventData.date.getMonth(),
      day: eventData.date.getDate(),
      year: eventData.date.getFullYear(),
      isAnnual: eventData.isAnnual,
      createdBy: eventData.createdBy,
      createdAt: now,
    });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as AnniversaryEvent;
  }

  async getEventsForMonth(siteId: string, month: number, year: number): Promise<AnniversaryEvent[]> {
    const db = this.getDb();
    const snapshot = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('month', '==', month)
      .orderBy('day', 'asc')
      .get();
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnniversaryEvent[];
    return events.filter(e => e.isAnnual || e.year === year);
  }
}
