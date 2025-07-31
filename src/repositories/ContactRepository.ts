import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
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
}

export const contactRepository = new ContactRepository();
