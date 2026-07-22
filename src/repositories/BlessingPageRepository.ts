import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { AnniversaryType } from '@/entities/Anniversary';
import type { BlessingPage } from '@/entities/BlessingPage';
import { buildBlessingPageSlug, resolveCanonicalBlessingPage, sortBlessingPages } from '@/repositories/BlessingPageRepository.utils';

export class BlessingPageRepository {
  private readonly collection = 'blessingPages';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(data: {
    eventId: string;
    siteId: string;
    year?: number;
    createdBy: string;
    eventType: AnniversaryType;
  }): Promise<BlessingPage> {
    const db = this.getDb();
    const existing = await this.getByEvent(data.eventId, data.eventType, data.year);

    if (existing) {
      return existing;
    }

    const slug = buildBlessingPageSlug(data.eventId, data.eventType, data.year);

    const pageData: Record<string, unknown> = {
      eventId: data.eventId,
      siteId: data.siteId,
      slug,
      createdBy: data.createdBy,
      createdAt: Timestamp.now(),
    };

    if (data.eventType !== 'death') {
      if (typeof data.year !== 'number') {
        throw new Error('Year is required for non-death blessing pages');
      }
      pageData.year = data.year;
    }

    const ref = await db.collection(this.collection).add(pageData);

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

  async getByEvent(eventId: string, eventType: AnniversaryType, year?: number): Promise<BlessingPage | null> {
    const db = this.getDb();
    const pages = await this.listRawByEvent(eventId, db);
    return resolveCanonicalBlessingPage(pages, eventType, year);
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

  private async listRawByEvent(eventId: string, db = this.getDb()): Promise<BlessingPage[]> {
    const qs = await db
      .collection(this.collection)
      .where('eventId', '==', eventId)
      .get();
    return sortBlessingPages(qs.docs.map((d) => ({ id: d.id, ...d.data() } as BlessingPage)));
  }

  async listByEvent(eventId: string, _eventType?: AnniversaryType): Promise<BlessingPage[]> {
    const db = this.getDb();
    const pages = await this.listRawByEvent(eventId, db);
    // Death pages are standing memorial pages: keep every legacy document around,
    // but sort newest-first so callers reuse the canonical page.
    return pages;
  }

  async listBySite(siteId: string): Promise<BlessingPage[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .get();
    return sortBlessingPages(qs.docs.map((d) => ({ id: d.id, ...d.data() } as BlessingPage)));
  }

  async setPublic(id: string, isPublic: boolean): Promise<BlessingPage> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).update({ isPublic });
    const doc = await db.collection(this.collection).doc(id).get();
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }
}
