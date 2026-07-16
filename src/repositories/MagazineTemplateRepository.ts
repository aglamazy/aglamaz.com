import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { IMagazineTemplate } from '@/entities/MagazineTemplate';

const COLLECTION = 'magazineTemplates';

export class MagazineTemplateRepository {
  // Optional injected Firestore instance, used by tests to avoid hitting real infra.
  constructor(private readonly db?: FirebaseFirestore.Firestore) {}

  private getDb(): FirebaseFirestore.Firestore {
    if (this.db) return this.db;
    initAdmin();
    return getFirestore();
  }

  async get(siteId: string): Promise<IMagazineTemplate | null> {
    const snap = await this.getDb().collection(COLLECTION).doc(siteId).get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    return {
      siteId,
      html: (data.html as string) || '',
      updatedAt: data.updatedAt,
      source: (data.source as IMagazineTemplate['source']) || 'manual',
    };
  }

  async save(
    siteId: string,
    html: string,
    source: IMagazineTemplate['source'] = 'manual'
  ): Promise<IMagazineTemplate> {
    const updatedAt = Timestamp.now();
    await this.getDb().collection(COLLECTION).doc(siteId).set(
      { html, updatedAt, source },
      { merge: true }
    );

    return { siteId, html, updatedAt, source };
  }
}
