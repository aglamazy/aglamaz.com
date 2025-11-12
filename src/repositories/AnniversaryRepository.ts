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

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate();
      } catch {
        return null;
      }
    }
    if (typeof value._seconds === 'number') {
      return new Date(value._seconds * 1000);
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private async buildHebrewOccurrences(params: {
    siteId: string;
    hebrewKey: string;
    baseDate: Date;
    startYearOverride?: number;
  }): Promise<Array<{ year: number; month: number; day: number; date: any }>> {
    const { siteId, hebrewKey, baseDate, startYearOverride } = params;
    if (!hebrewKey) return [];
    const hebHorizonYear = await this.config.getHorizonYear(siteId);
    const currentYear = new Date().getFullYear();
    const baseYear = baseDate.getFullYear();
    const startYear = Math.max(currentYear, baseYear, startYearOverride ?? baseYear);
    const endYear = Math.max(hebHorizonYear, startYear);
    const occurrences: Array<{ year: number; month: number; day: number; date: any }> = [];
    for (let y = startYear; y <= endYear; y++) {
      const g = findGregorianForHebrewKeyInYear(hebrewKey, y);
      if (g) {
        occurrences.push({ year: y, month: g.getMonth(), day: g.getDate(), date: Timestamp.fromDate(g) });
      }
    }
    return occurrences;
  }

  async create(eventData: {
    siteId: string;
    ownerId: string;
    name: string;
    description?: string;
    type: 'birthday' | 'death' | 'death_anniversary' | 'wedding';
    date: Date;
    deathDate?: Date;
    burialDate?: Date;
    isAnnual: boolean;
    createdBy: string;
    imageUrl?: string;
    useHebrew?: boolean;
  }): Promise<AnniversaryEvent> {
    const db = this.getDb();
    const now = Timestamp.now();
    const eventDate = Timestamp.fromDate(eventData.date);
    const base: any = {
      siteId: eventData.siteId,
      ownerId: eventData.ownerId,
      name: eventData.name,
      description: eventData.description || '',
      type: eventData.type,
      date: eventDate,
      month: eventData.date.getMonth(),
      day: eventData.date.getDate(),
      year: eventData.date.getFullYear(),
      isAnnual: eventData.isAnnual,
      imageUrl: eventData.imageUrl || '',
      createdAt: now,
    };
    const isDeathType = eventData.type === 'death' || eventData.type === 'death_anniversary';
    if (eventData.useHebrew) {
      base.useHebrew = true;
      let hebrewKeySource = eventData.date;
      let startYearOverride: number | undefined;
      if (isDeathType) {
        const deathDate = eventData.deathDate ?? eventData.date;
        const burialDate = eventData.burialDate;
        base.hebrewDate = formatHebrewDisplay(deathDate);
        base.hebrewKey = formatHebrewKey(deathDate);
        base.deathDate = Timestamp.fromDate(deathDate);
        if (burialDate) {
          base.burialDate = Timestamp.fromDate(burialDate);
          base.hebrewBurialDate = formatHebrewDisplay(burialDate);
          base.hebrewBurialKey = formatHebrewKey(burialDate);
          startYearOverride = burialDate.getFullYear() + 1;
        }
        hebrewKeySource = deathDate;
      } else {
        base.hebrewDate = formatHebrewDisplay(eventData.date);
        base.hebrewKey = formatHebrewKey(eventData.date);
      }
      if (base.hebrewKey) {
        base.hebrewOccurrences = await this.buildHebrewOccurrences({
          siteId: eventData.siteId,
          hebrewKey: base.hebrewKey,
          baseDate: hebrewKeySource,
          startYearOverride,
        });
      }
    } else if (isDeathType) {
      if (eventData.deathDate) {
        base.deathDate = Timestamp.fromDate(eventData.deathDate);
      }
      if (eventData.burialDate) {
        base.burialDate = Timestamp.fromDate(eventData.burialDate);
      }
    }
    const ref = await db.collection(this.collection).add(base);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as AnniversaryEvent;
  }

  async getEventsForMonth(siteId: string, month: number, year: number): Promise<AnniversaryEvent[]> {
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
        originalDate: ev.date,
      } as any);
    }

    const events = [...eventsBase.filter(e => !e.useHebrew), ...hebEventsForMonth];
    return events.filter(e => e.isAnnual || e.year === year).sort((a, b) => a.day - b.day);
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
    type?: 'birthday' | 'death' | 'death_anniversary' | 'wedding';
    date?: Date;
    deathDate?: Date;
    burialDate?: Date;
    isAnnual?: boolean;
    imageUrl?: string;
    useHebrew?: boolean;
  }): Promise<void> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Anniversary ${id} not found`);
    }

    const data: any = { ...updates };
    if (updates.date) {
      const eventDate = Timestamp.fromDate(updates.date);
      data.date = eventDate;
      data.month = updates.date.getMonth();
      data.day = updates.date.getDate();
      data.year = updates.date.getFullYear();
    }

    const resolvedType = (updates.type ?? (existing.type as any)) as
      | 'birthday'
      | 'death'
      | 'death_anniversary'
      | 'wedding';
    const isDeathType = resolvedType === 'death' || resolvedType === 'death_anniversary';
    const resolvedDate = updates.date ?? this.toDate(existing.date);
    let resolvedDeathDate =
      updates.deathDate ?? (existing.deathDate ? this.toDate(existing.deathDate) : resolvedDate);
    if (!resolvedDeathDate && resolvedDate) {
      resolvedDeathDate = resolvedDate;
    }
    let resolvedBurialDate =
      updates.burialDate ?? (existing.burialDate ? this.toDate(existing.burialDate) : undefined);

    const useHebrew = updates.useHebrew !== undefined ? updates.useHebrew : !!existing.useHebrew;

    if (updates.deathDate) {
      data.deathDate = Timestamp.fromDate(updates.deathDate);
    } else if (isDeathType && useHebrew && updates.date) {
      data.deathDate = Timestamp.fromDate(updates.date);
      resolvedDeathDate = updates.date;
    }

    if (updates.burialDate) {
      data.burialDate = Timestamp.fromDate(updates.burialDate);
      resolvedBurialDate = updates.burialDate;
    }

    if (useHebrew) {
      data.useHebrew = true;
      const hebrewSource = isDeathType ? resolvedDeathDate ?? resolvedDate : resolvedDate;
      if (hebrewSource) {
        data.hebrewDate = formatHebrewDisplay(hebrewSource);
        data.hebrewKey = formatHebrewKey(hebrewSource);
        let startYearOverride: number | undefined;
        if (isDeathType) {
          if (resolvedDeathDate && !data.deathDate) {
            data.deathDate = Timestamp.fromDate(resolvedDeathDate);
          }
          if (resolvedBurialDate) {
            data.burialDate = Timestamp.fromDate(resolvedBurialDate);
            data.hebrewBurialDate = formatHebrewDisplay(resolvedBurialDate);
            data.hebrewBurialKey = formatHebrewKey(resolvedBurialDate);
            startYearOverride = resolvedBurialDate.getFullYear() + 1;
          }
        }
        data.hebrewOccurrences = await this.buildHebrewOccurrences({
          siteId: existing.siteId,
          hebrewKey: data.hebrewKey,
          baseDate: hebrewSource,
          startYearOverride,
        });
      }
    } else if (updates.useHebrew === false) {
      data.useHebrew = false;
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
      const baseDate = this.toDate(ev.deathDate ?? ev.date);
      if (!baseDate) continue;
      let start = Math.max(currentYear, baseDate.getFullYear());
      if ((ev.type === 'death' || ev.type === 'death_anniversary') && ev.burialDate) {
        const burial = this.toDate(ev.burialDate);
        if (burial) {
          start = Math.max(start, burial.getFullYear() + 1);
        }
      }
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
