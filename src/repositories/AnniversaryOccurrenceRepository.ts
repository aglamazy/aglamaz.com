import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import { LocalizableDocument } from '@/services/LocalizationService';
import { ImageWithDimension } from '@/entities/ImageWithDimension';
import { AnniversaryEvent } from '@/entities/Anniversary';
import { ImportSourceLink } from '@/entities/ImportSourceLink';

export interface AnniversaryOccurrence extends LocalizableDocument {
  id: string;
  siteId: string;
  eventId: string;
  date: any; // Firestore Timestamp
  createdAt: any;
  createdBy: string;
  isOriginal?: boolean;
  imagesWithDimensions?: ImageWithDimension[]; // Images with dimensions for CLS prevention
  importSources?: ImportSourceLink[];
}

export class AnniversaryOccurrenceRepository {
  private readonly collection = 'anniversaryOccurrences';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  /** Normalize legacy dropboxFolderUrl → importSources on read */
  private normalizeImportSources(data: any): any {
    if (data.dropboxFolderUrl && !data.importSources) {
      data.importSources = [{ url: data.dropboxFolderUrl, type: 'dropbox' }];
    }
    delete data.dropboxFolderUrl;
    return data;
  }

  async create(data: {
    siteId: string;
    eventId: string;
    date: Date;
    createdBy: string;
    isOriginal?: boolean;
    imagesWithDimensions?: ImageWithDimension[];
    description?: string;
  }): Promise<AnniversaryOccurrence> {
    const db = this.getDb();
    const docData: Record<string, any> = {
      siteId: data.siteId,
      eventId: data.eventId,
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
      createdBy: data.createdBy,
      imagesWithDimensions: data.imagesWithDimensions || [],
      description: data.description || '',
    };
    if (data.isOriginal) {
      docData.isOriginal = true;
    }
    const ref = await db.collection(this.collection).add(docData);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as AnniversaryOccurrence;
  }

  async getById(id: string): Promise<AnniversaryOccurrence | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return this.normalizeImportSources({ id: doc.id, ...doc.data() }) as AnniversaryOccurrence;
  }

  async listByEvent(eventId: string): Promise<AnniversaryOccurrence[]> {
    const db = this.getDb();
    const qs = await db.collection(this.collection).where('eventId', '==', eventId).get();
    return qs.docs.map((d) => this.normalizeImportSources({ id: d.id, ...d.data() }) as AnniversaryOccurrence);
  }

  async listBySite(siteId: string, locale?: string, options?: { limit?: number; offset?: number }): Promise<AnniversaryOccurrence[]> {
    const db = this.getDb();
    let query = db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .orderBy('date', 'desc');

    // Apply pagination if provided
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const qs = await query.get();
    const items = qs.docs.map((d) => this.normalizeImportSources({ id: d.id, ...d.data() }) as AnniversaryOccurrence);

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
            console.error(`[AnniversaryOccurrenceRepository] Failed to localize ${item.id}:`, error);
            return item;
          }
        })
      );
    }

    return items;
  }

  async listBySiteAndRange(siteId: string, start: Date, end: Date): Promise<AnniversaryOccurrence[]> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<', Timestamp.fromDate(end))
      .orderBy('date', 'asc')
      .get();
    const items = qs.docs.map((d) => this.normalizeImportSources({ id: d.id, ...d.data() }) as AnniversaryOccurrence);
    return items;
  }

  async update(id: string, updates: {
    date?: Date;
    imagesWithDimensions?: ImageWithDimension[];
    description?: string;
    importSource?: ImportSourceLink;
  }): Promise<void> {
    const db = this.getDb();
    const data: any = {};
    if (updates.date) data.date = Timestamp.fromDate(updates.date);
    if (updates.imagesWithDimensions !== undefined) data.imagesWithDimensions = updates.imagesWithDimensions;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.importSource) {
      const doc = await db.collection(this.collection).doc(id).get();
      const existing: ImportSourceLink[] = doc.data()?.importSources || [];
      const filtered = existing.filter((s) => s.url !== updates.importSource!.url);
      data.importSources = [...filtered, updates.importSource];
    }
    await db.collection(this.collection).doc(id).update(data);
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }

  async ensureOriginalOccurrence(event: AnniversaryEvent, createdBy: string): Promise<AnniversaryOccurrence> {
    const db = this.getDb();
    const qs = await db
      .collection(this.collection)
      .where('eventId', '==', event.id)
      .where('isOriginal', '==', true)
      .limit(1)
      .get();

    if (!qs.empty) {
      const doc = qs.docs[0];
      return this.normalizeImportSources({ id: doc.id, ...doc.data() }) as AnniversaryOccurrence;
    }

    return this.create({
      siteId: event.siteId,
      eventId: event.id,
      date: event.date.toDate ? event.date.toDate() : new Date(event.date),
      createdBy,
      isOriginal: true,
    });
  }
}
