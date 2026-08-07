import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export type DigestCadence = 'weekly' | 'monthly';

/** One (cadence, period) group's send count - what the usage-data page reconciles against real digestSends docs. */
export interface DigestSendPeriodSummary {
  cadence: DigestCadence;
  periodKey: string;
  sent: number;
  lastSentAt: Timestamp;
}

const COLLECTION = 'digestSends';

/** ISO week key (e.g. "2026-W30") - stable across same-week reruns, rolls over correctly at week boundaries. */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday=0..Sunday=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Month key (e.g. "2026-07") - stable across same-month reruns. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodKeyFor(cadence: DigestCadence, date: Date): string {
  return cadence === 'weekly' ? weekKey(date) : monthKey(date);
}

/**
 * Per-member send tracking (Agla, 2026-07-24 - the "3 of 11" incident) so a
 * digest cron run is idempotent and safely re-runnable: an interrupted run
 * (deploy cutover, timeout, partial failure) can just run again - already-sent
 * members are skipped, only the gap gets filled. No caller needs to compute who
 * to retry; the cron always processes its full recipient list and this repo
 * filters it down to what's actually still needed.
 */
export class DigestSendRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docId(siteId: string, memberId: string, cadence: DigestCadence, periodKey: string): string {
    return `${siteId}_${memberId}_${cadence}_${periodKey}`;
  }

  async alreadySent(siteId: string, memberId: string, cadence: DigestCadence, periodKey: string): Promise<boolean> {
    const snap = await this.getDb().collection(COLLECTION).doc(this.docId(siteId, memberId, cadence, periodKey)).get();
    return snap.exists;
  }

  /** Bulk-check for a whole recipient list - one batched read instead of N sequential ones. */
  async filterUnsent<T extends { id: string }>(
    siteId: string,
    cadence: DigestCadence,
    periodKey: string,
    members: T[],
  ): Promise<T[]> {
    if (members.length === 0) return [];
    const db = this.getDb();
    const refs = members.map((m) => db.collection(COLLECTION).doc(this.docId(siteId, m.id, cadence, periodKey)));
    const snaps = await db.getAll(...refs);
    return members.filter((_, i) => !snaps[i].exists);
  }

  async markSent(siteId: string, memberId: string, cadence: DigestCadence, periodKey: string): Promise<void> {
    await this.getDb()
      .collection(COLLECTION)
      .doc(this.docId(siteId, memberId, cadence, periodKey))
      .set({ siteId, memberId, cadence, periodKey, sentAt: Timestamp.now() });
  }

  /**
   * Recent (cadence, period) send groups for a site, most-recently-sent first - the "how many
   * sends" half of the usage-data page's reconciliation (famcircle#148). Deliberately a single
   * equality filter with no orderBy (siteId only) so it doesn't need a composite index - grouping
   * and sorting happen in memory, which is fine at this collection's per-site volume.
   */
  async listRecentPeriods(siteId: string, limit = 12): Promise<DigestSendPeriodSummary[]> {
    const snapshot = await this.getDb().collection(COLLECTION).where('siteId', '==', siteId).get();

    const groups = new Map<string, DigestSendPeriodSummary>();
    for (const doc of snapshot.docs) {
      const data = doc.data() as { cadence: DigestCadence; periodKey: string; sentAt: Timestamp };
      const key = `${data.cadence}:${data.periodKey}`;
      const existing = groups.get(key);
      if (existing) {
        existing.sent += 1;
        if (data.sentAt.toMillis() > existing.lastSentAt.toMillis()) {
          existing.lastSentAt = data.sentAt;
        }
      } else {
        groups.set(key, { cadence: data.cadence, periodKey: data.periodKey, sent: 1, lastSentAt: data.sentAt });
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.lastSentAt.toMillis() - a.lastSentAt.toMillis())
      .slice(0, limit);
  }
}

export const digestSendRepository = new DigestSendRepository();
