import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
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

export interface CompileDigestOptions {
  locale?: string;
  recentPhotosLimit?: number;
}

/**
 * One event, told as a small article: its own description + its own photos, not just a
 * row. Photo URLs are merged from two DIFFERENT stores real usage actually populates:
 * GalleryPhoto docs linked via anniversaryId (uploaded through the general photo-add
 * flow), AND images embedded directly on AnniversaryOccurrence docs (uploaded inline
 * from the event's own detail page - the more common path in practice). Plain URLs, not
 * GalleryPhoto[], since occurrence images aren't GalleryPhoto docs at all.
 */
export interface DigestEventWithPhotos {
  event: AnniversaryEvent;
  photoUrls: string[];
  /** Slug of this event's (idempotently ensured) BlessingPage - lets the coming-events section link to "write a blessing" (Agla, 2026-07-22). */
  blessingPageSlug: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Shared shape for every cadence's digest - a "what happened" range and a "what's
 * coming" range, each with article-style entries (own description/photos). The two
 * cadences (monthly, weekly) differ ONLY in how pastRange/comingRange get computed
 * (DigestCompilerService.compileMonthlyDigest vs compileWeeklyDigest) - everything else
 * (querying, photo-merging, template rendering) is one shared path, per Agla's
 * 2026-07-21 DRY correction. Monthly: real calendar-month boundaries. Weekly: rolling
 * 1-week-back / 1-month-forward window, not calendar-aligned.
 */
export interface CadenceDigestPayload {
  siteId: string;
  pastRange: DateRange;
  comingRange: DateRange;
  pastEvents: DigestEventWithPhotos[];
  comingEvents: DigestEventWithPhotos[];
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
    private readonly galleryPhotoRepository: GalleryPhotoRepository = new GalleryPhotoRepository(),
    private readonly occurrenceRepository: AnniversaryOccurrenceRepository = new AnniversaryOccurrenceRepository(),
    private readonly blessingPageRepository: BlessingPageRepository = new BlessingPageRepository()
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
   * Monthly-cadence: the full calendar month before `referenceDate` (past) + the
   * current and next full calendar months (coming) - see CadenceDigestPayload doc
   * comment. Only the range computation is cadence-specific; compileCadenceDigest does
   * everything else.
   */
  async compileMonthlyDigest(siteId: string, referenceDate: Date, options?: CompileDigestOptions): Promise<CadenceDigestPayload> {
    const startMonth = referenceDate.getMonth();
    const startYear = referenceDate.getFullYear();
    const pastRange: DateRange = {
      startDate: new Date(startYear, startMonth - 1, 1),
      endDate: new Date(startYear, startMonth, 0), // last day of previous month
    };
    const comingRange: DateRange = {
      startDate: new Date(startYear, startMonth, 1),
      endDate: new Date(startYear, startMonth + 2, 0), // last day of next month
    };
    return this.compileCadenceDigest(siteId, pastRange, comingRange, options);
  }

  /**
   * Weekly-cadence: 1 week back (past) + 1 month forward (coming), rolling from
   * `referenceDate` - not calendar-aligned, since "weekly" implies a shorter, more
   * frequent look-back than monthly's full previous month (Agla, 2026-07-21: "maybe
   * just 1w back, and 1m forward, not exact month boundary").
   */
  async compileWeeklyDigest(siteId: string, referenceDate: Date, options?: CompileDigestOptions): Promise<CadenceDigestPayload> {
    const pastStart = new Date(referenceDate);
    pastStart.setDate(pastStart.getDate() - 7);
    const comingEnd = new Date(referenceDate);
    comingEnd.setMonth(comingEnd.getMonth() + 1);
    const pastRange: DateRange = { startDate: pastStart, endDate: referenceDate };
    const comingRange: DateRange = { startDate: referenceDate, endDate: comingEnd };
    return this.compileCadenceDigest(siteId, pastRange, comingRange, options);
  }

  /** The one real compile path every cadence shares - see CadenceDigestPayload doc comment. */
  private async compileCadenceDigest(
    siteId: string,
    pastRange: DateRange,
    comingRange: DateRange,
    options?: CompileDigestOptions,
  ): Promise<CadenceDigestPayload> {
    const recentPhotosLimit = options?.recentPhotosLimit ?? DEFAULT_RECENT_PHOTOS_LIMIT;

    const [pastEventsRaw, comingEventsRaw, photos] = await Promise.all([
      this.eventsInRange(siteId, pastRange.startDate, pastRange.endDate, options?.locale),
      this.eventsInRange(siteId, comingRange.startDate, comingRange.endDate, options?.locale),
      this.galleryPhotoRepository.listBySite(siteId, options?.locale, { limit: recentPhotosLimit }),
    ]);

    const [pastEvents, comingEvents] = await Promise.all([
      this.withPhotos(pastEventsRaw),
      this.withPhotos(comingEventsRaw),
    ]);

    return { siteId, pastRange, comingRange, pastEvents, comingEvents, photos };
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const sec = value._seconds ?? value.seconds;
    if (typeof sec === 'number') return new Date(sec * 1000);
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Merges each event's photos from GalleryPhoto (anniversaryId-linked) and
   * AnniversaryOccurrence (embedded) stores, year-filtered against the event's own
   * target display year, main picture leading - see DigestEventWithPhotos doc comment
   * and the 2026-07-21 corrections (an upcoming event with no photos yet must not show
   * a stale collage from an unrelated past year; the family's deliberately-chosen cover
   * picture must never be silently dropped).
   */
  private withPhotos(events: AnniversaryEvent[]): Promise<DigestEventWithPhotos[]> {
    return Promise.all(
      events.map(async (event) => {
        const [linkedPhotos, occurrences, blessingPage] = await Promise.all([
          this.galleryPhotoRepository.listByAnniversary(event.id),
          this.occurrenceRepository.listByEvent(event.id),
          this.blessingPageRepository.create({
            eventId: event.id,
            siteId: event.siteId,
            year: event.type === 'death' ? undefined : event.year,
            createdBy: event.ownerId,
            eventType: event.type,
          }),
        ]);
        const sameYear = (d: Date | null) => d !== null && d.getFullYear() === event.year;
        const linkedUrls = linkedPhotos
          .filter((p) => sameYear(this.toDate(p.date)))
          .map((p) => p.imagesWithDimensions?.[0]?.url)
          .filter((u): u is string => !!u);
        const occurrenceUrls = occurrences
          .filter((occ) => sameYear(this.toDate(occ.date)))
          .flatMap((occ) => occ.imagesWithDimensions?.map((img) => img.url).filter((u): u is string => !!u) ?? []);
        const allUrls = event.imageUrl ? [event.imageUrl, ...occurrenceUrls, ...linkedUrls] : [...occurrenceUrls, ...linkedUrls];
        const photoUrls = Array.from(new Set(allUrls));
        return { event, photoUrls, blessingPageSlug: blessingPage.slug };
      }),
    );
  }

  /**
   * Events whose actual occurrence date falls inside [startDate, endDate], spanning
   * however many calendar months the range touches.
   */
  private async eventsInRange(siteId: string, startDate: Date, endDate: Date, locale?: string): Promise<AnniversaryEvent[]> {
    const monthYearPairs = enumerateMonthYearPairs(startDate, endDate);
    const eventsByMonth = await Promise.all(
      monthYearPairs.map(({ month, year }) =>
        this.anniversaryRepository
          .getEventsForMonth(siteId, month, year, locale)
          .then((events) => events.map((event) => ({ ...event, month, year }))),
      ),
    );

    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);

    return eventsByMonth
      .flat()
      .filter((event) => {
        const occurrenceDate = new Date(event.year, event.month, event.day);
        return occurrenceDate >= rangeStart && occurrenceDate <= rangeEnd;
      })
      .sort((a, b) => new Date(a.year, a.month, a.day).getTime() - new Date(b.year, b.month, b.day).getTime());
  }
}
