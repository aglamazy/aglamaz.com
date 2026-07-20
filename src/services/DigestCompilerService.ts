import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import type { AnniversaryEvent } from '@/entities/Anniversary';
import type { GalleryPhoto } from '@/repositories/GalleryPhotoRepository';

const DEFAULT_RECENT_PHOTOS_LIMIT = 12;

export interface DigestPayload {
  siteId: string;
  month: number;
  year: number;
  events: AnniversaryEvent[];
  photos: GalleryPhoto[];
}

/** An AnniversaryEvent with its resolved occurrence date attached for the queried window -
 * event.year on annual events is the original creation year, not the occurrence year, so
 * callers that need "when does this actually fall in the window" must use occurrenceDate,
 * not reconstruct a date from event.year/month/day. */
export interface DigestWindowEvent extends AnniversaryEvent {
  occurrenceDate: Date;
}

export interface DigestWindowPayload {
  siteId: string;
  startDate: Date;
  endDate: Date;
  events: DigestWindowEvent[];
  photos: GalleryPhoto[];
}

export interface CompileDigestOptions {
  locale?: string;
  recentPhotosLimit?: number;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Every distinct (month, year) pair touched by [startDate, endDate], inclusive, in order. */
function enumerateMonths(startDate: Date, endDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= last) {
    months.push({ month: cursor.getMonth(), year: cursor.getFullYear() });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

/**
 * Pure assembly of existing repo queries into one payload for the monthly
 * magazine template. Does not query anything not already exposed by
 * AnniversaryRepository/GalleryPhotoRepository, and does not send anything
 * (that's famcircle#23).
 */
export class DigestCompilerService {
  constructor(
    private readonly anniversaryRepository: AnniversaryRepository = new AnniversaryRepository(),
    private readonly galleryPhotoRepository: GalleryPhotoRepository = new GalleryPhotoRepository()
  ) {}

  async compileDigest(siteId: string, month: number, year: number, options?: CompileDigestOptions): Promise<DigestPayload> {
    const recentPhotosLimit = options?.recentPhotosLimit ?? DEFAULT_RECENT_PHOTOS_LIMIT;

    const [events, photos] = await Promise.all([
      this.anniversaryRepository.getEventsForMonth(siteId, month, year, options?.locale),
      this.galleryPhotoRepository.listBySite(siteId, options?.locale, { limit: recentPhotosLimit }),
    ]);

    return { siteId, month, year, events, photos };
  }

  /**
   * Rolling-window variant for weekly-cadence subscribers (docs/family-digest-formats-spec.md
   * §1): a date range in, not a fixed calendar month. Reuses getEventsForMonth per calendar
   * month touched by the range (its Hebrew-occurrence resolution only works per queried
   * month/year), then filters down to events whose resolved occurrence actually falls inside
   * [startDate, endDate] - a range spanning e.g. this week through a month out touches parts
   * of two or three calendar months, only some of which belong in the window.
   */
  async compileDigestWindow(
    siteId: string,
    startDate: Date,
    endDate: Date,
    options?: CompileDigestOptions,
  ): Promise<DigestWindowPayload> {
    const recentPhotosLimit = options?.recentPhotosLimit ?? DEFAULT_RECENT_PHOTOS_LIMIT;
    const months = enumerateMonths(startDate, endDate);
    const windowStart = startOfDay(startDate);
    const windowEnd = endOfDay(endDate);

    const [eventsByMonth, photos] = await Promise.all([
      Promise.all(
        months.map(({ month, year }) =>
          this.anniversaryRepository.getEventsForMonth(siteId, month, year, options?.locale),
        ),
      ),
      this.galleryPhotoRepository.listBySite(siteId, options?.locale, { limit: recentPhotosLimit }),
    ]);

    const events = eventsByMonth
      .flatMap((monthEvents, idx) => {
        const { year } = months[idx];
        return monthEvents.map((event) => ({
          ...event,
          occurrenceDate: new Date(year, event.month, event.day),
        }));
      })
      .filter((event) => event.occurrenceDate >= windowStart && event.occurrenceDate <= windowEnd)
      .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());

    return { siteId, startDate, endDate, events, photos };
  }
}
