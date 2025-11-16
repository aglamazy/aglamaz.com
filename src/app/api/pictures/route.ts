import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { getResizedImageDownloadUrl } from '@/services/FirebaseStorageService';

export const dynamic = 'force-dynamic';

const getHandler = async (req: Request, context: GuardContext) => {
  try {
    const member = context.member!;

    // Get query parameters
    const url = new URL(req.url);
    const locale = url.searchParams.get('locale') || 'he';
    const limit = parseInt(url.searchParams.get('limit') || '0', 10) || undefined;
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || undefined;

    // Fetch both anniversary occurrences and gallery photos with localization and pagination
    const occRepo = new AnniversaryOccurrenceRepository();
    const galleryRepo = new GalleryPhotoRepository();
    const [occurrences, galleryPhotos] = await Promise.all([
      occRepo.listBySite(member.siteId, locale, { limit, offset }),
      galleryRepo.listBySite(member.siteId, locale, { limit, offset }),
    ]);

    // Add type field to distinguish between them
    const occurrenceItems = occurrences.map((item: any) => ({ ...item, type: 'occurrence' }));
    const galleryItems = galleryPhotos.map((item: any) => ({ ...item, type: 'gallery' }));

    // Merge and sort by date (newest first)
    const items = [...occurrenceItems, ...galleryItems].sort((a, b) => {
      const aDate = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const bDate = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return bDate.getTime() - aDate.getTime();
    });
    // Attach minimal event summaries (name) with localization
    const annRepo = new AnniversaryRepository();
    const familyRepo = new FamilyRepository();
    // Collect eventId from occurrences and anniversaryId from gallery photos
    const ids = Array.from(new Set(
      items.map((i: any) => i.eventId || i.anniversaryId).filter(Boolean)
    ));
    const events: Record<string, { name: string }> = {};
    for (const id of ids) {
      try {
        const ev = await annRepo.getById(id, locale);
        if (ev && ev.name) {
          events[id] = { name: ev.name };
        }
      } catch (error) {
        console.error(`[pictures] Failed to load anniversary ${id}:`, error);
      }
    }
    const authorIds = Array.from(new Set(items.map((i: any) => i.createdBy).filter(Boolean)));
    const authors: Record<string, { displayName: string; email: string }> = {};
    for (const id of authorIds) {
      try {
        const authorMember = await familyRepo.getMemberByUserId(id, member.siteId);
        if (!authorMember) continue;
        const displayName = (authorMember.displayName || authorMember.firstName || authorMember.email || '').trim();
        if (!displayName) {
          throw new Error('missing_display_name');
        }
        if (!authorMember.email) {
          throw new Error('missing_email');
        }
        authors[id] = {
          displayName,
          email: authorMember.email,
        };
      } catch (err) {
        console.warn('[pictures] failed to load author', id, err);
      }
    }

    // Generate resized image URLs with proper tokens for all images
    const itemsWithResizedUrls = await Promise.all(
      items.map(async (item: any) => {
        if (!item.images || !Array.isArray(item.images)) {
          return item;
        }

        // For each image URL in the images array, generate resized versions
        const resizedImages = await Promise.all(
          item.images.map(async (imageUrl: string) => {
            try {
              // Generate URLs for all needed sizes
              const [url400, url800, url1200] = await Promise.all([
                getResizedImageDownloadUrl(imageUrl, '400x400'),
                getResizedImageDownloadUrl(imageUrl, '800x800'),
                getResizedImageDownloadUrl(imageUrl, '1200x1200'),
              ]);

              return {
                original: imageUrl,
                '400x400': url400,
                '800x800': url800,
                '1200x1200': url1200,
              };
            } catch (error) {
              console.error('[pictures] Failed to generate resized URLs:', error);
              // Fallback to original
              return {
                original: imageUrl,
                '400x400': imageUrl,
                '800x800': imageUrl,
                '1200x1200': imageUrl,
              };
            }
          })
        );

        return {
          ...item,
          imagesResized: resizedImages,
        };
      })
    );

    return Response.json({ items: itemsWithResizedUrls, events, authors });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch pictures' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
