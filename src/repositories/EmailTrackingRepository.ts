import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { EmailTrackingSendType } from '@/services/EmailTrackingService';

const COLLECTION = 'emailTrackingEvents';

export type EmailTrackingEventType = 'open' | 'click';

export interface EmailTrackingEvent {
  siteId: string;
  recipientMemberId: string;
  sendType: EmailTrackingSendType;
  sendId: string;
  eventType: EmailTrackingEventType;
  userAgent?: string;
}

export interface EmailTrackingEventRecord extends EmailTrackingEvent {
  id: string;
  timestamp: Timestamp;
}

/**
 * Per-recipient email open/click log - one flat, insert-only doc per event (never a merge
 * write), same shape as gptCalls/digestSends already use in this repo. Deliberately flat
 * rather than nested-merge (see famcircle#105 - .set(obj, {merge:true}) does not nest
 * dotted-string keys, only .update() does; a flat insert-only doc sidesteps that bug class
 * by construction).
 */
export class EmailTrackingRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async logEvent(event: EmailTrackingEvent): Promise<void> {
    await this.getDb()
      .collection(COLLECTION)
      .add({
        siteId: event.siteId,
        recipientMemberId: event.recipientMemberId,
        sendType: event.sendType,
        sendId: event.sendId,
        eventType: event.eventType,
        userAgent: event.userAgent ?? null,
        timestamp: Timestamp.now(),
      });
  }

  /** All open/click events for one logical send (e.g. one digest period) - the per-recipient opened/clicked table. */
  async getEventsForSend(siteId: string, sendType: EmailTrackingSendType, sendId: string): Promise<EmailTrackingEventRecord[]> {
    const snap = await this.getDb()
      .collection(COLLECTION)
      .where('siteId', '==', siteId)
      .where('sendType', '==', sendType)
      .where('sendId', '==', sendId)
      .get();

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as EmailTrackingEventRecord))
      .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  }

  /** Most recent events across all sends - used for ad-hoc verification, not a product surface. */
  async getRecentEvents(limit: number): Promise<EmailTrackingEventRecord[]> {
    const snap = await this.getDb().collection(COLLECTION).orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EmailTrackingEventRecord));
  }

  /**
   * Every open/click event for a site, most recent first - the raw feed the usage-data admin
   * page groups per send. Sorted in memory (not via Firestore orderBy) so this doesn't need a
   * new siteId+timestamp composite index, same tradeoff getEventsForSend already makes.
   */
  async getEventsForSite(siteId: string): Promise<EmailTrackingEventRecord[]> {
    const snap = await this.getDb().collection(COLLECTION).where('siteId', '==', siteId).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as EmailTrackingEventRecord))
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  }
}

export const emailTrackingRepository = new EmailTrackingRepository();
