import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface GalleryPhoto {
  id: string;
  siteId: string;
  createdBy: string;
  createdAt: Timestamp;
  date: Timestamp; // Display date for the photo
  images: string[]; // Array of Firebase Storage URLs
  description?: string;
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
    images: string[];
    description?: string;
    anniversaryId?: string;
  }): Promise<GalleryPhoto> {
    const db = this.getDb();
    const ref = await db.collection(this.collection).add({
      siteId: data.siteId,
      createdBy: data.createdBy,
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
      images: data.images,
      description: data.description || '',
      anniversaryId: data.anniversaryId || null,
      deletedAt: null,
    });
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

  async listBySite(siteId: string): Promise<GalleryPhoto[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('deletedAt', '==', null)
      .orderBy('date', 'desc')
      .get();
    return qs.docs.map((d) => ({ id: d.id, ...doc.data() } as GalleryPhoto));
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
      images?: string[];
      description?: string;
      anniversaryId?: string | null;
    }
  ): Promise<void> {
    const db = this.getDb();
    const data: any = {};
    if (updates.date) data.date = Timestamp.fromDate(updates.date);
    if (updates.images !== undefined) data.images = updates.images;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.anniversaryId !== undefined) data.anniversaryId = updates.anniversaryId;
    await db.collection(this.collection).doc(id).update(data);
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
