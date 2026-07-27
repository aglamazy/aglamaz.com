import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

const COLLECTION = 'blogAutogenRuns';

/**
 * Per-site-per-period dedup for the blog-autogen cron (famcircle buddy#16) - mirrors
 * DigestSendRepository's dedup pattern (Agla, 2026-07-24 - the "3 of 11" incident):
 * Vercel Cron can fire the same schedule multiple times in a burst, so a re-fire must be
 * a safe no-op instead of creating a second auto-drafted post for the same site+period.
 * One doc per (siteId, periodKey), keyed deterministically so the check-then-write has no
 * separate "already claimed" race window worth worrying about for a once-a-month cron.
 */
export class BlogAutogenRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docId(siteId: string, periodKey: string): string {
    return `${siteId}_${periodKey}`;
  }

  async alreadyGenerated(siteId: string, periodKey: string): Promise<boolean> {
    const snap = await this.getDb().collection(COLLECTION).doc(this.docId(siteId, periodKey)).get();
    return snap.exists;
  }

  async markGenerated(siteId: string, periodKey: string, postId: string): Promise<void> {
    await this.getDb()
      .collection(COLLECTION)
      .doc(this.docId(siteId, periodKey))
      .set({ siteId, periodKey, postId, generatedAt: Timestamp.now() });
  }
}

export const blogAutogenRepository = new BlogAutogenRepository();
