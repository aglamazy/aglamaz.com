import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export type MagazineCadence = 'weekly' | 'monthly' | 'none';

export interface NotificationPreferences {
  memberId: string;
  siteId: string;
  birthOptOut: boolean;
  deathOptOut: boolean;
  magazineCadence: MagazineCadence;
  updatedAt?: Timestamp;
}

const DEFAULT_PREFERENCES = {
  birthOptOut: false,
  deathOptOut: false,
  magazineCadence: 'monthly' as MagazineCadence,
} as const;

export class NotificationPreferencesRepository {
  private readonly collection = 'notificationPreferences';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private docRef(memberId: string) {
    return this.getDb().collection(this.collection).doc(memberId);
  }

  async get(memberId: string, siteId: string): Promise<NotificationPreferences> {
    const snap = await this.docRef(memberId).get();
    if (!snap.exists) {
      return { memberId, siteId, ...DEFAULT_PREFERENCES };
    }
    const data = snap.data() as Partial<NotificationPreferences>;
    return {
      memberId,
      siteId,
      birthOptOut: data.birthOptOut ?? DEFAULT_PREFERENCES.birthOptOut,
      deathOptOut: data.deathOptOut ?? DEFAULT_PREFERENCES.deathOptOut,
      magazineCadence: data.magazineCadence ?? DEFAULT_PREFERENCES.magazineCadence,
      updatedAt: data.updatedAt,
    };
  }

  async update(
    memberId: string,
    siteId: string,
    updates: Partial<Pick<NotificationPreferences, 'birthOptOut' | 'deathOptOut' | 'magazineCadence'>>,
  ): Promise<NotificationPreferences> {
    const current = await this.get(memberId, siteId);
    const next = {
      memberId,
      siteId,
      birthOptOut: updates.birthOptOut ?? current.birthOptOut,
      deathOptOut: updates.deathOptOut ?? current.deathOptOut,
      magazineCadence: updates.magazineCadence ?? current.magazineCadence,
      updatedAt: Timestamp.now(),
    };
    await this.docRef(memberId).set(next, { merge: true });
    return next;
  }
}

export const notificationPreferencesRepository = new NotificationPreferencesRepository();
