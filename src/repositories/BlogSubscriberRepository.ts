import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';

export interface BlogSubscriber {
  id: string;
  email: string;
  siteId: string;
  createdAt: Timestamp;
}

export class BlogSubscriberRepository {
  private readonly collection = 'blogSubscribers';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async addSubscriber(data: Omit<BlogSubscriber, 'id' | 'createdAt'>): Promise<BlogSubscriber> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc();
    const createdAt = Timestamp.now();
    await ref.set({ ...data, createdAt });
    return { id: ref.id, ...data, createdAt };
  }

  // Sorts in memory rather than orderBy() in the query, so this doesn't need a new
  // siteId+createdAt composite Firestore index (see firestore.indexes.json landmine).
  async getBySite(siteId: string): Promise<BlogSubscriber[]> {
    const db = this.getDb();
    const snap = await db.collection(this.collection).where('siteId', '==', siteId).get();
    return snap.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as Omit<BlogSubscriber, 'id'>) } as BlogSubscriber))
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }
}

export const blogSubscriberRepository = new BlogSubscriberRepository();
