import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { getLocalizedFields, ensureLocale } from '@/services/LocalizationService';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const getHandler = async (req: Request, context: GuardContext) => {
  try {
    const member = context.member!;

    // Get locale from query parameter (default to 'he')
    const url = new URL(req.url);
    const locale = url.searchParams.get('locale') || 'he';

    // Fetch both anniversary occurrences and gallery photos
    const occRepo = new AnniversaryOccurrenceRepository();
    const galleryRepo = new GalleryPhotoRepository();
    const [occurrences, galleryPhotos] = await Promise.all([
      occRepo.listBySite(member.siteId),
      galleryRepo.listBySite(member.siteId),
    ]);

    // Add type field to distinguish between them
    const occurrenceItems = occurrences.map((item: any) => ({ ...item, type: 'occurrence' }));

    // Ensure locale for gallery photos (JIT translation)
    const db = getFirestore();
    const galleryItems = await Promise.all(
      galleryPhotos.map(async (item: any) => {
        try {
          // Ensure locale exists, translate if needed
          const docRef = db.collection('galleryPhotos').doc(item.id);
          const ensuredItem = await ensureLocale(item, docRef, locale, ['description']);

          // Get localized fields after ensuring
          const localizedFields = getLocalizedFields(ensuredItem, locale, ['description']);

          return {
            ...ensuredItem,
            type: 'gallery',
            description: localizedFields.description
          };
        } catch (error) {
          console.error(`[pictures] Failed to ensure locale for gallery photo ${item.id}:`, error);
          // Fallback: return item without translation
          return { ...item, type: 'gallery' };
        }
      })
    );

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
        const ev = await annRepo.getById(id);
        if (ev) {
          // Ensure locale exists, translate if needed (JIT)
          const docRef = db.collection('anniversaries').doc(id);
          const ensuredEv = await ensureLocale(ev, docRef, locale, ['name']);

          // Get localized fields after ensuring
          const localizedFields = getLocalizedFields(ensuredEv, locale, ['name']);

          // Only include event if localized name exists
          if (localizedFields.name) {
            events[id] = { name: localizedFields.name };
          }
        }
      } catch (error) {
        console.error(`[pictures] Failed to ensure locale for anniversary ${id}:`, error);
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
    return Response.json({ items, events, authors });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch pictures' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
