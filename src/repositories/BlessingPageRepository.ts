import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { BlessingPage } from '@/entities/BlessingPage';

export class BlessingPageRepository {
  private readonly collection = 'blessingPages';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(data: {
    eventId: string;
    siteId: string;
    year: number;
    createdBy: string;
  }): Promise<BlessingPage> {
    const db = this.getDb();

    // Generate slug: eventId-year
    const slug = `${data.eventId}-${data.year}`;

    // Check if blessing page already exists for this event and year
    const existing = await this.getByEventAndYear(data.eventId, data.year);
    if (existing) {
      return existing;
    }

    const ref = await db.collection(this.collection).add({
      eventId: data.eventId,
      siteId: data.siteId,
      year: data.year,
      slug,
      createdBy: data.createdBy,
      createdAt: Timestamp.now(),
    });

    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  async getById(id: string): Promise<BlessingPage | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  async getBySlug(slug: string): Promise<BlessingPage | null> {
    const db = this.getDb();
    const qs = await db.collection(this.collection).where('slug', '==', slug).limit(1).get();
    if (qs.empty) return null;
    const doc = qs.docs[0];
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  async getByEventAndYear(eventId: string, year: number): Promise<BlessingPage | null> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('eventId', '==', eventId)
      .where('year', '==', year)
      .limit(1)
      .get();
    if (qs.empty) return null;
    const doc = qs.docs[0];
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  async listByEvent(eventId: string): Promise<BlessingPage[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('eventId', '==', eventId)
      .orderBy('year', 'desc')
      .get();
    return qs.docs.map((d) => ({ id: d.id, ...d.data() } as BlessingPage));
  }

  async listBySite(siteId: string): Promise<BlessingPage[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .orderBy('year', 'desc')
      .get();
    return qs.docs.map((d) => ({ id: d.id, ...d.data() } as BlessingPage));
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }
}
