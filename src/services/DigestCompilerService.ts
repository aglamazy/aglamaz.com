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

export interface DigestWindowPayload {
  siteId: string;
  from: Date;
  to: Date;
  events: AnniversaryEvent[];
  photos: GalleryPhoto[];
}

export interface CompileDigestOptions {
  locale?: string;
  recentPhotosLimit?: number;
}

function getMonthsInRange(from: Date, to: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  let current = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (current <= end) {
    months.push({ month: current.getUTCMonth(), year: current.getUTCFullYear() });
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  }
  return months;
}

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

  async compileRollingWindowDigest(
    siteId: string,
    from: Date,
    to: Date,
    options?: CompileDigestOptions,
  ): Promise<DigestWindowPayload> {
    const months = getMonthsInRange(from, to);

    const eventsByMonth = await Promise.all(
      months.map(({ month, year }) =>
        this.anniversaryRepository
          .getEventsForMonth(siteId, month, year, options?.locale)
          .then(evs => evs.map(e => ({ event: e, queriedYear: year }))),
      ),
    );

    const seenIds = new Set<string>();
    const events: AnniversaryEvent[] = [];
    for (const monthResults of eventsByMonth) {
      for (const { event, queriedYear } of monthResults) {
        if (seenIds.has(event.id)) continue;
        // Gregorian annual events retain their creation year; use the queried year
        // for the occurrence check. Hebrew annual events already have year set to
        // the occurrence year by getEventsForMonth.
        const effectiveYear = event.isAnnual && !event.useHebrew ? queriedYear : event.year;
        const eventDate = new Date(Date.UTC(effectiveYear, event.month, event.day));
        if (eventDate >= from && eventDate <= to) {
          seenIds.add(event.id);
          events.push(event);
        }
      }
    }

    const recentPhotosLimit = options?.recentPhotosLimit ?? DEFAULT_RECENT_PHOTOS_LIMIT;
    const photos = await this.galleryPhotoRepository.listBySite(siteId, options?.locale, { limit: recentPhotosLimit });

    return { siteId, from, to, events, photos };
  }
}
