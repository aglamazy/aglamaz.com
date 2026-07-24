import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { SendableDigestCadence } from '@/services/DigestRecipientResolver';

export interface DigestPreviewSendRecord {
  siteId: string;
  cadence: SendableDigestCadence;
  /** "YYYY-MM-DD" of the target Friday (weekly) or "YYYY-MM" of the target month (monthly). */
  periodKey: string;
  sentAt: Timestamp;
}

/**
 * Dedup/period-tracking for the digest preview cron (src/app/api/cron/digest-preview/route.ts)
 * - the preview cron runs daily but should only ever email the admin once per site per
 * cadence period, not once per daily run.
 */
export class DigestPreviewSendRepository {
  private readonly collection = 'digestPreviewSends';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docId(siteId: string, cadence: SendableDigestCadence, periodKey: string): string {
    return `${siteId}_${cadence}_${periodKey}`;
  }

  async hasSent(siteId: string, cadence: SendableDigestCadence, periodKey: string): Promise<boolean> {
    const db = this.getDb();
    const snap = await db.collection(this.collection).doc(this.docId(siteId, cadence, periodKey)).get();
    return snap.exists;
  }

  async markSent(record: Omit<DigestPreviewSendRecord, 'sentAt'>): Promise<void> {
    const db = this.getDb();
    await db
      .collection(this.collection)
      .doc(this.docId(record.siteId, record.cadence, record.periodKey))
      .set({
        ...record,
        sentAt: Timestamp.now(),
      });
  }
}
