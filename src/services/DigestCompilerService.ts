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

/**
 * Rolling-window variant of DigestPayload for weekly-cadence subscribers
 * (docs/family-digest-formats-spec.md §1) - a date range instead of a fixed
 * calendar month.
 */
export interface DigestRangePayload {
  siteId: string;
  startDate: Date;
  endDate: Date;
  events: AnniversaryEvent[];
  photos: GalleryPhoto[];
}

export interface CompileDigestOptions {
  locale?: string;
  recentPhotosLimit?: number;
}

/** One past event, told as a small article: its own description + its own photos, not just a row. */
export interface PastDigestEvent {
  event: AnniversaryEvent;
  photos: GalleryPhoto[];
}

/**
 * Full calendar months (not a rolling window) for the monthly-cadence digest: everything
 * that happened in the month just finished (as article-style entries with their own
 * description/photos), and everything coming up over the current + next calendar month
 * (two months, so there's always a real forward-looking window even sent on the last day
 * of a month - a single "current month" window would show almost nothing then). Per
 * Agla's live-testing correction 2026-07-21 - a rolling "now to now+1 month" window
 * produced random-looking period boundaries; recipients expect real calendar-month
 * boundaries.
 */
export interface MonthlyDigestPayload {
  siteId: string;
  pastMonth: { month: number; year: number };
  comingRange: { startMonth: number; startYear: number; endMonth: number; endYear: number };
  pastEvents: PastDigestEvent[];
  comingEvents: AnniversaryEvent[];
  photos: GalleryPhoto[];
}

function enumerateMonthYearPairs(startDate: Date, endDate: Date): Array<{ month: number; year: number }> {
  const pairs: Array<{ month: number; year: number }> = [];
  let month = startDate.getMonth();
  let year = startDate.getFullYear();
  const endMonth = endDate.getMonth();
  const endYear = endDate.getFullYear();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    pairs.push({ month, year });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return pairs;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
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
   * Monthly-cadence compile: the full calendar month before `referenceDate` (what
   * happened - as article-style entries with their own photos) plus the current +
   * next full calendar month (what's coming) - see MonthlyDigestPayload doc comment.
   */
  async compileMonthlyDigest(
    siteId: string,
    referenceDate: Date,
    options?: CompileDigestOptions,
  ): Promise<MonthlyDigestPayload> {
    const recentPhotosLimit = options?.recentPhotosLimit ?? DEFAULT_RECENT_PHOTOS_LIMIT;
    const startMonth = referenceDate.getMonth();
    const startYear = referenceDate.getFullYear();
    const nextRef = new Date(startYear, startMonth + 1, 1);
    const endMonth = nextRef.getMonth();
    const endYear = nextRef.getFullYear();
    const pastRef = new Date(startYear, startMonth - 1, 1);
    const pastMonth = pastRef.getMonth();
    const pastYear = pastRef.getFullYear();

    const [comingEventsThisMonth, comingEventsNextMonth, pastEventsRaw, photos] = await Promise.all([
      this.anniversaryRepository.getEventsForMonth(siteId, startMonth, startYear, options?.locale),
      this.anniversaryRepository.getEventsForMonth(siteId, endMonth, endYear, options?.locale),
      this.anniversaryRepository.getEventsForMonth(siteId, pastMonth, pastYear, options?.locale),
      this.galleryPhotoRepository.listBySite(siteId, options?.locale, { limit: recentPhotosLimit }),
    ]);

    // getEventsForMonth returns each annual event with its ORIGINAL stored year
    // (e.g. a birth year) for non-Hebrew events - remap to the month actually being
    // displayed, or a birthday digest row shows "1993" instead of the real target
    // year (Agla, 2026-07-21 live-testing correction).
    const comingEvents = [
      ...comingEventsThisMonth.map((e) => ({ ...e, month: startMonth, year: startYear })),
      ...comingEventsNextMonth.map((e) => ({ ...e, month: endMonth, year: endYear })),
    ].sort((a, b) => new Date(a.year, a.month, a.day).getTime() - new Date(b.year, b.month, b.day).getTime());

    const pastEventsRemapped = pastEventsRaw.map((e) => ({ ...e, month: pastMonth, year: pastYear }));
    const pastEvents: PastDigestEvent[] = await Promise.all(
      pastEventsRemapped.map(async (event) => ({
        event,
        photos: await this.galleryPhotoRepository.listByAnniversary(event.id),
      })),
    );

    return {
      siteId,
      pastMonth: { month: pastMonth, year: pastYear },
      comingRange: { startMonth, startYear, endMonth, endYear },
      pastEvents,
      comingEvents,
      photos,
    };
  }

  /**
   * Rolling-window compile for weekly-cadence subscribers: covers [startDate, endDate]
   * which may span more than one calendar month, by querying getEventsForMonth for
   * every month the range touches (same query the monthly path uses) and filtering
   * down to events whose actual occurrence date falls inside the window. The queried
   * year - not the event doc's own (possibly stale, original-entry) year field - is
   * used to build each occurrence date, since getEventsForMonth already resolves
   * annual/Hebrew recurrences against that year.
   */
  async compileDigestForRange(
    siteId: string,
    startDate: Date,
    endDate: Date,
    options?: CompileDigestOptions,
  ): Promise<DigestRangePayload> {
    const recentPhotosLimit = options?.recentPhotosLimit ?? DEFAULT_RECENT_PHOTOS_LIMIT;
    const monthYearPairs = enumerateMonthYearPairs(startDate, endDate);

    const [eventsByMonth, photos] = await Promise.all([
      Promise.all(
        monthYearPairs.map(({ month, year }) =>
          this.anniversaryRepository
            .getEventsForMonth(siteId, month, year, options?.locale)
            .then((events) => events.map((event) => ({ ...event, month, year }))),
        ),
      ),
      this.galleryPhotoRepository.listBySite(siteId, options?.locale, { limit: recentPhotosLimit }),
    ]);

    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);

    const events = eventsByMonth
      .flat()
      .filter((event) => {
        const occurrenceDate = new Date(event.year, event.month, event.day);
        return occurrenceDate >= rangeStart && occurrenceDate <= rangeEnd;
      })
      .sort((a, b) => new Date(a.year, a.month, a.day).getTime() - new Date(b.year, b.month, b.day).getTime());

    return { siteId, startDate, endDate, events, photos };
  }
}
