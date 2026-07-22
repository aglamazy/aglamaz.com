import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import {
  DEFAULT_PREFERENCES,
  normalizeCadence,
  normalizePreferences,
  type NotificationPreferences,
} from '@/repositories/NotificationPreferencesRepository.utils';

export type {
  MagazineCadence,
  NotificationPreferences,
  UnifiedMagazineCadence,
} from '@/repositories/NotificationPreferencesRepository.utils';

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
    return normalizePreferences(memberId, siteId, snap.data());
  }

  async update(
    memberId: string,
    siteId: string,
    updates: Partial<Pick<NotificationPreferences, 'magazineCadence' | 'inDayRemindersEnabled'>>,
  ): Promise<NotificationPreferences> {
    const current = await this.get(memberId, siteId);
    const next = {
      memberId,
      siteId,
      magazineCadence:
        updates.magazineCadence !== undefined ? normalizeCadence(updates.magazineCadence) : current.magazineCadence,
      inDayRemindersEnabled: updates.inDayRemindersEnabled ?? current.inDayRemindersEnabled,
      updatedAt: Timestamp.now(),
    };
    await this.docRef(memberId).set(next);
    return next;
  }
}

export const notificationPreferencesRepository = new NotificationPreferencesRepository();
