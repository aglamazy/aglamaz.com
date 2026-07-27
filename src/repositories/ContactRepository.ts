import { getFirestore, Timestamp, type Query } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  siteId?: string;
  createdAt: Timestamp;
}

export class ContactRepository {
  private readonly collection = 'contactMessages';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async addContactMessage(data: Omit<ContactMessage, 'id' | 'createdAt'>): Promise<ContactMessage> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc();
    const createdAt = Timestamp.now();
    await ref.set({ ...data, createdAt });
    return { id: ref.id, ...data, createdAt };
  }

  async getAllMessages(): Promise<ContactMessage[]> {
    const db = this.getDb();
    const snap = await db.collection(this.collection).orderBy('createdAt', 'desc').get();
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<ContactMessage, 'id'>) })) as ContactMessage[];
  }

  async countMessages(siteId?: string): Promise<number> {
    const db = this.getDb();
    let query: Query = db.collection(this.collection);
    if (siteId) {
      query = query.where('siteId', '==', siteId);
    }
    const snap = await query.get();
    return snap.size;
  }
}

export const contactRepository = new ContactRepository();
