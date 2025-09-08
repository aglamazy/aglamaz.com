import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface SiteConfigDoc {
  hebHorizonYear: number;
}

export class ConfigRepository {
  private readonly collection = 'config';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async getHorizonYear(siteId: string): Promise<number> {
    const db = this.getDb();
    const snap = await db.collection(this.collection).doc(siteId).get();
    const currentYear = new Date().getFullYear();
    if (!snap.exists) {
      await db.collection(this.collection).doc(siteId).set({ hebHorizonYear: currentYear }, { merge: true });
      return currentYear;
    }
    const data = snap.data() as Partial<SiteConfigDoc> | undefined;
    return typeof data?.hebHorizonYear === 'number' ? data!.hebHorizonYear : currentYear;
  }

  async setHorizonYear(siteId: string, year: number): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(siteId).set({ hebHorizonYear: year }, { merge: true });
  }
}
