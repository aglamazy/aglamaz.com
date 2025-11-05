import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (_req: Request, context: GuardContext) => {
  try {
    const member = context.member!;

    // Fetch both anniversary occurrences and gallery photos
    const occRepo = new AnniversaryOccurrenceRepository();
    const galleryRepo = new GalleryPhotoRepository();
    const [occurrences, galleryPhotos] = await Promise.all([
      occRepo.listBySite(member.siteId),
      galleryRepo.listBySite(member.siteId),
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
    // Attach minimal event summaries (name) to reduce client round-trips
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
        if (ev) events[id] = { name: ev.name };
      } catch {}
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
