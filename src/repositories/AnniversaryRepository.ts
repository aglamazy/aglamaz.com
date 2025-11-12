import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import type { AnniversaryEvent } from '@/entities/Anniversary';
import { formatHebrewDisplay, formatHebrewKey, findGregorianForHebrewKeyInYear } from '@/utils/hebrew';
import { ConfigRepository } from '@/repositories/ConfigRepository';

export class AnniversaryRepository {
  private readonly collection = 'anniversaries';
  private readonly config = new ConfigRepository();

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(eventData: {
    siteId: string;
    ownerId: string;
    name: string;
    description?: string;
    type: 'birthday' | 'death' | 'wedding';
    date: Date;
    isAnnual: boolean;
    createdBy: string;
    imageUrl?: string;
    useHebrew?: boolean;
    locale: string;
  }): Promise<AnniversaryEvent> {
    const db = this.getDb();
    const now = Timestamp.now();
    const eventDate = Timestamp.fromDate(eventData.date);

    // Build locales structure for the name field
    const localeData: any = {
      name: eventData.name,
      name$meta: {
        source: 'manual',
        updatedAt: now,
      }
    };

    const base: any = {
      siteId: eventData.siteId,
      ownerId: eventData.ownerId,
      name: eventData.name, // Keep for backward compatibility
      description: eventData.description || '',
      type: eventData.type,
      date: eventDate,
      month: eventData.date.getMonth(),
      day: eventData.date.getDate(),
      year: eventData.date.getFullYear(),
      isAnnual: eventData.isAnnual,
      imageUrl: eventData.imageUrl || '',
      primaryLocale: eventData.locale,
      locales: {
        [eventData.locale]: localeData
      },
      createdAt: now,
    };
    if (eventData.useHebrew) {
      base.useHebrew = true;
      base.hebrewDate = formatHebrewDisplay(eventData.date);
      base.hebrewKey = formatHebrewKey(eventData.date);
      // Precompute occurrences up to horizon year
      const hebHorizonYear = await this.config.getHorizonYear(eventData.siteId);
      const startYear = Math.max(new Date().getFullYear(), eventData.date.getFullYear());
      const endYear = Math.max(hebHorizonYear, startYear);
      const occurrences: Array<{ year: number; month: number; day: number; date: any }> = [];
      for (let y = startYear; y <= endYear; y++) {
        const g = findGregorianForHebrewKeyInYear(base.hebrewKey, y);
        if (g) {
          occurrences.push({ year: y, month: g.getMonth(), day: g.getDate(), date: Timestamp.fromDate(g) });
        }
      }
      base.hebrewOccurrences = occurrences;
    }
    const ref = await db.collection(this.collection).add(base);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as AnniversaryEvent;
  }

  async getEventsForMonth(siteId: string, month: number, year: number, locale?: string): Promise<AnniversaryEvent[]> {
    const db = this.getDb();
    const snapshot = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('month', '==', month)
      .orderBy('day', 'asc')
      .get();
    const eventsBase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnniversaryEvent[];

    // Fetch Hebrew-marked events separately (all months) and map using precomputed occurrences
    const hebSnap = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('useHebrew', '==', true)
      .get();
    const hebEventsAll = hebSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnniversaryEvent[];
    const hebEventsForMonth: AnniversaryEvent[] = [];
    for (const ev of hebEventsAll) {
      if (!ev.isAnnual) continue;
      const occ = (ev.hebrewOccurrences || []).find((o) => o.year === year && o.month === month);
      if (!occ) continue;
      hebEventsForMonth.push({
        ...ev,
        month: occ.month,
        day: occ.day,
        year: occ.year,
        date: occ.date,
      } as any);
    }

    let events = [...eventsBase.filter(e => !e.useHebrew), ...hebEventsForMonth];
    events = events.filter(e => e.isAnnual || e.year === year).sort((a, b) => a.day - b.day);

    // Apply localization if locale is specified
    if (locale) {
      const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
      const localizedEvents: AnniversaryEvent[] = [];
      for (const event of events) {
        try {
          const docRef = db.collection(this.collection).doc(event.id);
          const ensured = await ensureLocale(event, docRef, locale, ['name']);
          const localized = getLocalizedFields(ensured, locale, ['name']);
          localizedEvents.push({ ...ensured, name: localized.name });
        } catch (error) {
          console.error(`[AnniversaryRepository] Failed to localize event ${event.id}:`, error);
          localizedEvents.push(event);
        }
      }
      return localizedEvents;
    }

    return events;
  }

  async getById(id: string, locale?: string): Promise<AnniversaryEvent | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;

    const event = { id: doc.id, ...doc.data() } as AnniversaryEvent;

    // If locale is specified, ensure and apply localization
    if (locale) {
      const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
      try {
        const docRef = db.collection(this.collection).doc(id);
        const ensured = await ensureLocale(event, docRef, locale, ['name']);
        const localized = getLocalizedFields(ensured, locale, ['name']);
        return { ...ensured, name: localized.name };
      } catch (error) {
        console.error(`[AnniversaryRepository] Failed to localize ${id}:`, error);
        return event;
      }
    }

    return event;
  }

  async update(id: string, updates: {
    name?: string;
    description?: string;
    type?: 'birthday' | 'death' | 'wedding';
    date?: Date;
    isAnnual?: boolean;
    imageUrl?: string;
    useHebrew?: boolean;
    locale?: string;
  }): Promise<void> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Anniversary ${id} not found`);
    }

    const locale = updates.locale || existing.primaryLocale || 'he';
    const data: any = {};

    // Handle localized name field
    if (updates.name !== undefined) {
      data.name = updates.name; // Keep for backward compatibility

      // Update locales structure using LocalizationService
      const docRef = db.collection(this.collection).doc(id);
      const { saveLocalizedContent } = await import('@/services/LocalizationService');
      await saveLocalizedContent(
        docRef,
        existing,
        locale,
        { name: updates.name },
        'manual',
        Timestamp.now()
      );
    }

    // Handle non-localized fields
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.isAnnual !== undefined) data.isAnnual = updates.isAnnual;
    if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.date) {
      const eventDate = Timestamp.fromDate(updates.date);
      data.date = eventDate;
      data.month = updates.date.getMonth();
      data.day = updates.date.getDate();
      data.year = updates.date.getFullYear();
      if (updates.useHebrew) {
        data.useHebrew = true;
        data.hebrewDate = formatHebrewDisplay(updates.date);
        data.hebrewKey = formatHebrewKey(updates.date);
        // Recompute occurrences up to horizon
        const hebHorizonYear = await this.config.getHorizonYear(existing.siteId);
        const startYear = Math.max(new Date().getFullYear(), updates.date.getFullYear());
        const endYear = Math.max(hebHorizonYear, startYear);
        const occurrences: Array<{ year: number; month: number; day: number; date: any }> = [];
        for (let y = startYear; y <= endYear; y++) {
          const g = findGregorianForHebrewKeyInYear(data.hebrewKey, y);
          if (g) {
            occurrences.push({ year: y, month: g.getMonth(), day: g.getDate(), date: Timestamp.fromDate(g) });
          }
        }
        data.hebrewOccurrences = occurrences;
      }
    }
    if (updates.useHebrew !== undefined && !updates.date) {
      data.useHebrew = !!updates.useHebrew;
      if (updates.useHebrew && existing.date) {
        const d = (existing.date as Timestamp).toDate();
        data.hebrewDate = formatHebrewDisplay(d);
        data.hebrewKey = formatHebrewKey(d);
        // compute occurrences up to horizon
        const hebHorizonYear = await this.config.getHorizonYear(existing.siteId);
        const startYear = Math.max(new Date().getFullYear(), d.getFullYear());
        const endYear = Math.max(hebHorizonYear, startYear);
        const occurrences: Array<{ year: number; month: number; day: number; date: any }> = [];
        for (let y = startYear; y <= endYear; y++) {
          const g = findGregorianForHebrewKeyInYear(data.hebrewKey, y);
          if (g) {
            occurrences.push({ year: y, month: g.getMonth(), day: g.getDate(), date: Timestamp.fromDate(g) });
          }
        }
        data.hebrewOccurrences = occurrences;
      }
    }
    await db.collection(this.collection).doc(id).update(data);
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }

  // Ensure horizon covers the requested year; if not, extend and backfill occurrences for Hebrew events
  async ensureHebrewHorizonForYear(siteId: string, targetYear: number): Promise<void> {
    const hebHorizonYear = await this.config.getHorizonYear(siteId);
    if (targetYear <= hebHorizonYear) return;
    const db = this.getDb();
    const hebSnap = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('useHebrew', '==', true)
      .get();
    const batch = db.batch();
    const currentYear = new Date().getFullYear();
    for (const doc of hebSnap.docs) {
      const ev = { id: doc.id, ...doc.data() } as any;
      const key = ev.hebrewKey as string | undefined;
      if (!key || ev.isAnnual === false) continue;
      const existing: Array<{ year: number; month: number; day: number; date: any }> = Array.isArray(ev.hebrewOccurrences) ? ev.hebrewOccurrences : [];
      const existingYears = new Set(existing.map((o) => o.year));
      const eventYear = ev.date ? (ev.date as Timestamp).toDate().getFullYear() : currentYear;
      const start = Math.max(currentYear, eventYear);
      const additions: Array<{ year: number; month: number; day: number; date: any }> = [];
      for (let y = start; y <= targetYear; y++) {
        if (existingYears.has(y)) continue;
        const g = findGregorianForHebrewKeyInYear(key, y);
        if (g) additions.push({ year: y, month: g.getMonth(), day: g.getDate(), date: Timestamp.fromDate(g) });
      }
      if (additions.length > 0) {
        const ref = db.collection(this.collection).doc(ev.id);
        batch.update(ref, { hebrewOccurrences: [...existing, ...additions] });
      }
    }
    await batch.commit();
    await this.config.setHorizonYear(siteId, targetYear);
  }
}
