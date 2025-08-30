import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import crypto from 'crypto';

export class SentMessageRepository {
  private readonly collection = 'sentMessages';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private makeId(type: string, key: string) {
    const h = crypto.createHash('sha256').update(`${type}:${key}`).digest('hex');
    return `${type}_${h}`;
  }

  async shouldSend(type: string, key: string, intervalMs: number): Promise<boolean> {
    const db = this.getDb();
    const id = this.makeId(type, key);
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return true;
    const last = (doc.data()?.lastSent as Timestamp) || null;
    if (!last) return true;
    const elapsed = Date.now() - last.toMillis();
    return elapsed >= intervalMs;
  }

  async markSent(type: string, key: string): Promise<void> {
    const db = this.getDb();
    const id = this.makeId(type, key);
    await db.collection(this.collection).doc(id).set({
      type,
      key,
      lastSent: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }
}

export const sentMessageRepository = new SentMessageRepository();

