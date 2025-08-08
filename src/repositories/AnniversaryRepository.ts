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
    ownerId: string;
    name: string;
    description?: string;
    type: 'birthday' | 'death' | 'wedding';
    date: Date;
    isAnnual: boolean;
    createdBy: string;
    imageUrl?: string;
  }): Promise<AnniversaryEvent> {
    const db = this.getDb();
    const now = Timestamp.now();
    const eventDate = Timestamp.fromDate(eventData.date);
    const ref = await db.collection(this.collection).add({
      siteId: eventData.siteId,
      ownerId: eventData.ownerId,
      name: eventData.name,
      description: eventData.description || '',
      type: eventData.type,
      date: eventDate,
      month: eventData.date.getMonth(),
      day: eventData.date.getDate(),
      year: eventData.date.getFullYear(),
      isAnnual: eventData.isAnnual,
      imageUrl: eventData.imageUrl || '',
      createdAt: now,
      imageUrl: eventData.imageUrl || '',
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

  async getById(id: string): Promise<AnniversaryEvent | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as AnniversaryEvent;
  }

  async update(id: string, updates: {
    name?: string;
    description?: string;
    type?: 'birthday' | 'death' | 'wedding';
    date?: Date;
    isAnnual?: boolean;
    imageUrl?: string;
  }): Promise<void> {
    const db = this.getDb();
    const data: any = { ...updates };
    if (updates.date) {
      const eventDate = Timestamp.fromDate(updates.date);
      data.date = eventDate;
      data.month = updates.date.getMonth();
      data.day = updates.date.getDate();
      data.year = updates.date.getFullYear();
    }
    await db.collection(this.collection).doc(id).update(data);
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }
}
