import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface ILoginAudit {
  id: string;
  siteId: string;
  memberId: string;
  email: string;
  provider: string;
  createdAt: Timestamp;
}

const COLLECTION = 'loginAudits';

export class LoginAuditRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async record(entry: { siteId: string; memberId: string; email: string; provider: string }): Promise<void> {
    await this.getDb().collection(COLLECTION).add({
      ...entry,
      createdAt: Timestamp.now(),
    });
  }

  async listBySite(siteId: string, limit = 200): Promise<ILoginAudit[]> {
    const snapshot = await this.getDb()
      .collection(COLLECTION)
      .where('siteId', '==', siteId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ILoginAudit);
  }
}

export const loginAuditRepository = new LoginAuditRepository();
