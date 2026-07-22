import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface BlessingMagicLink {
  token: string;
  siteId: string;
  blessingPageId: string;
  /** Display label for the view page - the event's name at creation time, so it doesn't shift if the event is later renamed. */
  honoreeLabel: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

const LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48h - Agla, 2026-07-22: "valid for 48h"

/**
 * No-login, read-only links to a specific blessing page - the honoree's own
 * "read what your family wrote for you" link (both the member-mapped and
 * raw-email-invite honoree paths use the SAME mechanism, per Agla's
 * 2026-07-22 correction: "All links should be magic links to read only
 * status, valid for 48h" - not the account-creating invite flow, and not
 * requiring the honoree to already be a logged-in member either).
 */
export class BlessingMagicLinkRepository {
  private readonly collection = 'blessingMagicLinks';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(data: { siteId: string; blessingPageId: string; honoreeLabel: string }): Promise<BlessingMagicLink> {
    const db = this.getDb();
    const { randomUUID } = require('crypto');
    const token = randomUUID();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + LINK_TTL_MS));

    const record: BlessingMagicLink = {
      token,
      siteId: data.siteId,
      blessingPageId: data.blessingPageId,
      honoreeLabel: data.honoreeLabel,
      createdAt: now,
      expiresAt,
    };
    await db.collection(this.collection).doc(token).set(record);
    return record;
  }

  /** Returns null for a missing OR expired link - callers should 404 either way, not distinguish. */
  async getByToken(token: string): Promise<BlessingMagicLink | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(token).get();
    if (!doc.exists) return null;
    const record = doc.data() as BlessingMagicLink;
    if (record.expiresAt.toMillis() <= Date.now()) return null;
    return record;
  }
}
