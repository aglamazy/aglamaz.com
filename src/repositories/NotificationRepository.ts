import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';

export interface AdminNotification {
  id: string;
  eventType: string;
  payload: any;
  createdAt: Timestamp;
}

export class NotificationRepository {
  private readonly collection = 'sentMessages';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async addNotification(data: Omit<AdminNotification, 'id' | 'createdAt'>): Promise<AdminNotification> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc();
    const createdAt = Timestamp.now();
    await ref.set({ ...data, createdAt });
    return { id: ref.id, ...data, createdAt };
  }
}

export const notificationRepository = new NotificationRepository();
