import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { Blessing } from '@/entities/Blessing';

export class BlessingRepository {
  private readonly collection = 'blessings';

  // Optional injected Firestore instance, used by tests to avoid hitting real infra.
  constructor(private readonly db?: FirebaseFirestore.Firestore) {}

  private getDb() {
    if (this.db) return this.db;
    initAdmin();
    return getFirestore();
  }

  async create(data: {
    blessingPageId: string;
    siteId: string;
    authorId: string;
    authorName: string;
    content: string;
    locale: string;
    taggedMemberIds?: string[];
    visibleToPublic?: boolean;
    isNonMemberContribution?: boolean;
    guestEmail?: string;
  }): Promise<Blessing> {
    const db = this.getDb();
    const now = Timestamp.now();

    // Build locales structure for content field
    const localeData: any = {
      content: data.content,
      content$meta: {
        source: 'manual',
        updatedAt: now,
      }
    };

    const blessing: Record<string, unknown> = {
      blessingPageId: data.blessingPageId,
      siteId: data.siteId,
      authorId: data.authorId,
      authorName: data.authorName,
      content: data.content, // Keep for backward compatibility
      locales: {
        [data.locale]: localeData
      },
      taggedMemberIds: data.taggedMemberIds || [],
      createdAt: now,
      updatedAt: now,
      deleted: false,
      visibleToPublic: data.visibleToPublic === true,
      isNonMemberContribution: data.isNonMemberContribution === true,
    };

    // Firestore rejects `undefined` field values, so only set guestEmail when provided.
    if (data.guestEmail) {
      blessing.guestEmail = data.guestEmail;
    }

    const ref = await db.collection(this.collection).add(blessing);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as Blessing;
  }

  async getById(id: string, locale?: string): Promise<Blessing | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;

    const blessing = { id: doc.id, ...doc.data() } as Blessing;

    // If locale is specified, ensure and apply localization
    if (locale) {
      const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
      try {
        const docRef = db.collection(this.collection).doc(id);
        const ensured = await ensureLocale(blessing, docRef, locale, ['content']);
        const localized = getLocalizedFields(ensured, locale, ['content']);
        return { ...ensured, content: localized.content };
      } catch (error) {
        console.error(`[BlessingRepository] Failed to localize ${id}:`, error);
        return blessing;
      }
    }

    return blessing;
  }

  async listByBlessingPage(blessingPageId: string, locale?: string): Promise<Blessing[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('blessingPageId', '==', blessingPageId)
      .where('deleted', '==', false)
      .orderBy('createdAt', 'desc')
      .get();

    const blessings = qs.docs.map((d) => ({ id: d.id, ...d.data() } as Blessing));

    // If locale is specified, ensure and apply localization
    if (locale) {
      const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
      const localizedBlessings: Blessing[] = [];
      for (const blessing of blessings) {
        try {
          const docRef = db.collection(this.collection).doc(blessing.id);
          const ensured = await ensureLocale(blessing, docRef, locale, ['content']);
          const localized = getLocalizedFields(ensured, locale, ['content']);
          localizedBlessings.push({ ...ensured, content: localized.content });
        } catch (error) {
          console.error(`[BlessingRepository] Failed to localize ${blessing.id}:`, error);
          localizedBlessings.push(blessing);
        }
      }
      return localizedBlessings;
    }

    return blessings;
  }

  /**
   * Blessings for a memorial page's public (non-member) view. Only ever
   * returns blessings the author explicitly marked visibleToPublic — this is
   * the privacy boundary the public memorial page route must filter through,
   * never `listByBlessingPage` (which is member-facing and returns everything).
   */
  async listPublicByBlessingPage(blessingPageId: string, locale?: string): Promise<Blessing[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('blessingPageId', '==', blessingPageId)
      .where('deleted', '==', false)
      .where('visibleToPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const blessings = qs.docs.map((d) => ({ id: d.id, ...d.data() } as Blessing));

    if (locale) {
      const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
      const localizedBlessings: Blessing[] = [];
      for (const blessing of blessings) {
        try {
          const docRef = db.collection(this.collection).doc(blessing.id);
          const ensured = await ensureLocale(blessing, docRef, locale, ['content']);
          const localized = getLocalizedFields(ensured, locale, ['content']);
          localizedBlessings.push({ ...ensured, content: localized.content });
        } catch (error) {
          console.error(`[BlessingRepository] Failed to localize ${blessing.id}:`, error);
          localizedBlessings.push(blessing);
        }
      }
      return localizedBlessings;
    }

    return blessings;
  }

  async update(id: string, updates: {
    content?: string;
    locale?: string;
    taggedMemberIds?: string[];
    visibleToPublic?: boolean;
  }): Promise<void> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Blessing ${id} not found`);
    }

    if (!updates.locale) {
      throw new Error('locale is required for update');
    }
    const locale = updates.locale;
    const data: any = {
      updatedAt: Timestamp.now(),
    };

    if (updates.taggedMemberIds !== undefined) {
      data.taggedMemberIds = updates.taggedMemberIds;
    }

    if (updates.visibleToPublic !== undefined) {
      data.visibleToPublic = updates.visibleToPublic;
    }

    // Handle localized content field
    if (updates.content !== undefined) {
      data.content = updates.content; // Keep for backward compatibility

      // Update locales structure using LocalizationService
      const docRef = db.collection(this.collection).doc(id);
      const { saveLocalizedContent } = await import('@/services/LocalizationService');
      await saveLocalizedContent(
        docRef,
        existing,
        locale,
        { content: updates.content },
        'manual',
        Timestamp.now()
      );
    }

    await db.collection(this.collection).doc(id).update(data);
  }

  async softDelete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).update({
      deleted: true,
      deletedAt: Timestamp.now(),
    });
  }

  async hardDelete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }
}
