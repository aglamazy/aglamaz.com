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

export interface CompileDigestOptions {
  locale?: string;
  recentPhotosLimit?: number;
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
}
