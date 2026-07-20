import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { BlessingPage } from '@/entities/BlessingPage';

export class BlessingPageRepository {
  private readonly collection = 'blessingPages';
  // Optional injected DB — used in unit tests to avoid real Firestore calls
  private readonly _db?: any;

  constructor(db?: any) {
    this._db = db;
  }

  private getDb() {
    if (this._db) return this._db;
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

    // Check if blessing page already exists for this event and year
    const existing = await this.getByEventAndYear(data.eventId, data.year);
    if (existing) {
      return existing;
    }

    const slug = `${data.eventId}-${data.year}`;
    const ref = await db.collection(this.collection).add({
      eventId: data.eventId,
      siteId: data.siteId,
      year: data.year,
      pageType: 'annual',
      slug,
      createdBy: data.createdBy,
      createdAt: Timestamp.now(),
    });

    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  // Creates a standing memorial page for a death-type event.
  // Idempotent: returns the existing page if one already exists for this event.
  // Standing pages have no year — the same page is reused every year.
  // Migration note: if a death event already has year-based annual pages from before this
  // change, they remain in Firestore and are returned by listByEvent. The standing page is
  // created alongside them; the UI prefers the standing page (pageType === 'standing').
  async createStanding(data: {
    eventId: string;
    siteId: string;
    createdBy: string;
  }): Promise<BlessingPage> {
    const existing = await this.getByEventStanding(data.eventId);
    if (existing) {
      return existing;
    }

    const db = this.getDb();
    // Slug is the eventId alone (no year suffix)
    const slug = data.eventId;
    const ref = await db.collection(this.collection).add({
      eventId: data.eventId,
      siteId: data.siteId,
      pageType: 'standing',
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

  // Returns the standing (non-year-pinned) page for a death-type event, or null if none.
  async getByEventStanding(eventId: string): Promise<BlessingPage | null> {
    const db = this.getDb();
    // Fetch all pages for this event and filter by pageType in application code to avoid
    // requiring a composite (eventId, pageType) Firestore index.
    const qs = await db
      .collection(this.collection)
      .where('eventId', '==', eventId)
      .get();
    const doc = qs.docs.find((d: any) => d.data().pageType === 'standing');
    if (!doc) return null;
    return { id: doc.id, ...doc.data() } as BlessingPage;
  }

  // Returns all blessing pages for an event: standing page first, then annual pages
  // sorted by year descending. Sorting is done in application code to avoid requiring
  // composite Firestore indexes that would exclude docs without a year field.
  async listByEvent(eventId: string): Promise<BlessingPage[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('eventId', '==', eventId)
      .get();
    const all = qs.docs.map((d: any) => ({ id: d.id, ...d.data() } as BlessingPage));
    return all.sort((a: BlessingPage, b: BlessingPage) => {
      if (a.pageType === 'standing') return -1;
      if (b.pageType === 'standing') return 1;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }

  async listBySite(siteId: string): Promise<BlessingPage[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .get();
    const all = qs.docs.map((d: any) => ({ id: d.id, ...d.data() } as BlessingPage));
    return all.sort((a: BlessingPage, b: BlessingPage) => {
      if (a.pageType === 'standing') return -1;
      if (b.pageType === 'standing') return 1;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }
}
