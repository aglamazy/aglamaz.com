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
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const url = new URL(req.url);
    const locale = url.searchParams.get('locale') || 'he';
    const limit = parseInt(url.searchParams.get('limit') || '0', 10) || undefined;
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || undefined;
    const sizesParam = url.searchParams.get('sizes');
    const sizes = sizesParam ? sizesParam.split(',') : [];

    // Fetch both sources — over-fetch from each so we can paginate the merged result
    const occRepo = new AnniversaryOccurrenceRepository();
    const galleryRepo = new GalleryPhotoRepository();
    const fetchLimit = limit ? (offset ?? 0) + limit : undefined;
    const [occurrences, galleryPhotos] = await Promise.all([
      occRepo.listBySite(siteId, locale, { limit: fetchLimit }),
      galleryRepo.listBySite(siteId, locale, { limit: fetchLimit }),
    ]);

    // Add type field to distinguish between them
    const occurrenceItems = occurrences.map((item: any) => ({ ...item, type: 'occurrence' }));
    const galleryItems = galleryPhotos.map((item: any) => ({ ...item, type: 'gallery' }));

    // Merge, sort, then apply offset+limit to the combined result
    const allItems = [...occurrenceItems, ...galleryItems].sort((a, b) => {
      const aDate = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const bDate = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return bDate.getTime() - aDate.getTime();
    });
    const items = allItems.slice(offset ?? 0, limit ? (offset ?? 0) + limit : undefined);
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
        const authorMember = await familyRepo.getMemberByUserId(id, siteId);
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

    // Generate resized image URLs only for requested sizes
    const responseItems = sizes.length > 0
      ? await Promise.all(
          items.map(async (item: any) => {
            if (!item.imagesWithDimensions || !Array.isArray(item.imagesWithDimensions)) {
              return item;
            }

            const resizedImages = await Promise.all(
              item.imagesWithDimensions.map(async (img: any) => {
                const entry: Record<string, any> = {
                  original: img.url,
                  width: img.width,
                  height: img.height,
                };
                const urls = await Promise.all(
                  sizes.map((size) => getResizedImageDownloadUrl(img.url, size))
                );
                sizes.forEach((size, i) => { entry[size] = urls[i]; });
                return entry;
              })
            );

            return { ...item, imagesResized: resizedImages };
          })
        )
      : items;

    return Response.json({ items: responseItems, events, authors });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch pictures' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
