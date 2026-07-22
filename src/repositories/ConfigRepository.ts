import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface SiteConfigDoc {
  hebHorizonYear?: number;
  siteNameTranslations?: Record<string, string>;
}

export class ConfigRepository {
  private readonly collection = 'config';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docRef(siteId: string) {
    return this.getDb().collection(this.collection).doc(siteId);
  }

  async getSiteConfig(siteId: string): Promise<Partial<SiteConfigDoc>> {
    const snap = await this.docRef(siteId).get();
    if (!snap.exists) return {};
    return snap.data() as Partial<SiteConfigDoc>;
  }

  async setSiteConfig(siteId: string, data: Partial<SiteConfigDoc>): Promise<void> {
    await this.docRef(siteId).set(data, { merge: true });
  }

  async getHorizonYear(siteId: string): Promise<number> {
    const currentYear = new Date().getFullYear();
    const data = await this.getSiteConfig(siteId);
    if (typeof data.hebHorizonYear === 'number') return data.hebHorizonYear;
    await this.setSiteConfig(siteId, { hebHorizonYear: currentYear });
    return currentYear;
  }

  async setHorizonYear(siteId: string, year: number): Promise<void> {
    await this.setSiteConfig(siteId, { hebHorizonYear: year });
  }

  async getSiteNameTranslations(siteId: string): Promise<Record<string, string>> {
    const data = await this.getSiteConfig(siteId);
    return { ...(data.siteNameTranslations || {}) };
  }

  async setSiteNameTranslations(siteId: string, translations: Record<string, string>): Promise<void> {
    await this.setSiteConfig(siteId, { siteNameTranslations: translations });
  }
}
