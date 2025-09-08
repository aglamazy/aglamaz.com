import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface AnniversaryOccurrence {
  id: string;
  siteId: string;
  eventId: string;
  date: any; // Firestore Timestamp
  createdAt: any;
  createdBy: string;
}

export class AnniversaryOccurrenceRepository {
  private readonly collection = 'anniversaryOccurrences';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(data: { siteId: string; eventId: string; date: Date; createdBy: string }): Promise<AnniversaryOccurrence> {
    const db = this.getDb();
    const ref = await db.collection(this.collection).add({
      siteId: data.siteId,
      eventId: data.eventId,
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
      createdBy: data.createdBy,
    });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as AnniversaryOccurrence;
  }

  async getById(id: string): Promise<AnniversaryOccurrence | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as AnniversaryOccurrence;
  }

  async listByEvent(eventId: string): Promise<AnniversaryOccurrence[]> {
    const db = this.getDb();
    const qs = await db.collection(this.collection).where('eventId', '==', eventId).get();
    return qs.docs.map((d) => ({ id: d.id, ...d.data() } as AnniversaryOccurrence));
  }

  async update(id: string, updates: { date?: Date }): Promise<void> {
    const db = this.getDb();
    const data: any = {};
    if (updates.date) data.date = Timestamp.fromDate(updates.date);
    await db.collection(this.collection).doc(id).update(data);
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }
}
