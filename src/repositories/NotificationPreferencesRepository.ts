import { Firestore, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface NotificationPreferencesRecord {
  memberId: string;
  siteId: string;
  magazineOptOut: boolean;
  birthOptOut: boolean;
  deathOptOut: boolean;
  yahrzeitWaOptOut: boolean;
  updatedAt: Timestamp;
}

const COLLECTION = 'notificationPreferences';

export class NotificationPreferencesRepository {
  constructor(private readonly db?: Firestore) {}

  private getDb(): Firestore {
    if (this.db) return this.db;
    initAdmin();
    return getFirestore();
  }

  async get(memberId: string): Promise<NotificationPreferencesRecord | null> {
    const snap = await this.getDb().collection(COLLECTION).doc(memberId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      memberId,
      siteId: data.siteId as string,
      magazineOptOut: !!(data.magazineOptOut),
      birthOptOut: !!(data.birthOptOut),
      deathOptOut: !!(data.deathOptOut),
      yahrzeitWaOptOut: !!(data.yahrzeitWaOptOut),
      updatedAt: data.updatedAt as Timestamp,
    };
  }

  async setMagazineOptOut(memberId: string, siteId: string, optOut: boolean): Promise<void> {
    const updatedAt = Timestamp.now();
    await this.getDb().collection(COLLECTION).doc(memberId).set(
      { memberId, siteId, magazineOptOut: optOut, updatedAt },
      { merge: true },
    );
  }
}
