import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import { LocalizableDocument } from '@/services/LocalizationService';
import { ImageWithDimension } from '@/entities/ImageWithDimension';

export interface GalleryPhoto extends LocalizableDocument {
  id: string;
  siteId: string;
  createdBy: string;
  createdAt: Timestamp;
  date: Timestamp; // Display date for the photo
  imagesWithDimensions: ImageWithDimension[]; // Images with dimensions
  anniversaryId?: string; // Optional link to anniversary
  deletedAt: Timestamp | null; // null for active, Timestamp for soft delete
}

export class GalleryPhotoRepository {
  private readonly collection = 'galleryPhotos';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(data: {
    siteId: string;
    createdBy: string;
    date: Date;
    imagesWithDimensions: ImageWithDimension[];
    description: string;
    anniversaryId?: string;
    locale: string;
  }): Promise<GalleryPhoto> {
    const db = this.getDb();

    // Validate images
    if (!Array.isArray(data.imagesWithDimensions) || data.imagesWithDimensions.length === 0) {
      throw new Error('At least one image with dimensions is required');
    }

    const now = Timestamp.now();

    // Build localized description structure (nested object for add(), not dot notation)
    const docToSave = {
      siteId: data.siteId,
      createdBy: data.createdBy,
      date: Timestamp.fromDate(data.date),
      createdAt: now,
      imagesWithDimensions: data.imagesWithDimensions,
      anniversaryId: data.anniversaryId || null,
      deletedAt: null,
      locales: {
        [data.locale]: {
          description: data.description,
          description$meta: {
            source: 'manual',
            updatedAt: now,
          },
        },
      },
    };

    const ref = await db.collection(this.collection).add(docToSave);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as GalleryPhoto;
  }

  async getById(id: string): Promise<GalleryPhoto | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    const data = { id: doc.id, ...doc.data() } as GalleryPhoto;
    // Return null if soft deleted
    if (data.deletedAt) return null;
    return data;
  }

  async listBySite(siteId: string, locale?: string, options?: { limit?: number; offset?: number }): Promise<GalleryPhoto[]> {
    const db = this.getDb();
    let query = db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('deletedAt', '==', null)
      .orderBy('date', 'desc');

    // Apply pagination if provided
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const qs = await query.get();
    const items = qs.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto));

    // If locale is specified, ensure and apply localization
    if (locale) {
      const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
      return Promise.all(
        items.map(async (item) => {
          try {
            const docRef = db.collection(this.collection).doc(item.id);
            const ensuredItem = await ensureLocale(item, docRef, locale, ['description']);
            const localizedFields = getLocalizedFields(ensuredItem, locale, ['description']);
            return { ...ensuredItem, description: localizedFields.description };
          } catch (error) {
            console.error(`[GalleryPhotoRepository] Failed to localize ${item.id}:`, error);
            return item;
          }
        })
      );
    }

    return items;
  }

  async listByAnniversary(anniversaryId: string): Promise<GalleryPhoto[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('anniversaryId', '==', anniversaryId)
      .where('deletedAt', '==', null)
      .orderBy('date', 'desc')
      .get();
    return qs.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto));
  }

  async update(
    id: string,
    updates: {
      date?: Date;
      imagesWithDimensions?: ImageWithDimension[];
      description?: string;
      anniversaryId?: string | null;
      locale?: string;
    }
  ): Promise<void> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`GalleryPhoto ${id} not found`);
    }

    if (!updates.locale) {
      throw new Error('locale is required for update');
    }
    const locale = updates.locale;
    const data: any = {};

    // Handle localized description field
    if (updates.description !== undefined) {
      data.description = updates.description; // Keep for backward compatibility

      // Update locales structure using LocalizationService
      const docRef = db.collection(this.collection).doc(id);
      const { saveLocalizedContent } = await import('@/services/LocalizationService');
      await saveLocalizedContent(
        docRef,
        existing,
        locale,
        { description: updates.description },
        'manual',
        Timestamp.now()
      );
    }

    // Handle non-localized fields
    if (updates.date) data.date = Timestamp.fromDate(updates.date);
    if (updates.imagesWithDimensions !== undefined) data.imagesWithDimensions = updates.imagesWithDimensions;
    if (updates.anniversaryId !== undefined) data.anniversaryId = updates.anniversaryId;

    // Only update non-localized fields if there are any
    if (Object.keys(data).length > 0) {
      await db.collection(this.collection).doc(id).update(data);
    }
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    // Soft delete by setting deletedAt timestamp
    await db.collection(this.collection).doc(id).update({
      deletedAt: Timestamp.now(),
    });
  }

  async hardDelete(id: string): Promise<void> {
    const db = this.getDb();
    // Actual deletion from Firestore
    await db.collection(this.collection).doc(id).delete();
  }
}
