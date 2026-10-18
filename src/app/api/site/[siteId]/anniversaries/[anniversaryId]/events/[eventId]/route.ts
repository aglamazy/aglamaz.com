import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { extractImageDimensions } from '@/utils/imageDimensions';
import type { ImageWithDimension } from '@/entities/ImageWithDimension';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string; eventId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;
    const eventId = params?.eventId;

    if (!siteId || !anniversaryId || !eventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(eventId);
    if (!occ || occ.siteId !== siteId || occ.eventId !== anniversaryId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    return Response.json({ event: occ });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string; eventId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;
    const eventId = params?.eventId;

    if (!siteId || !anniversaryId || !eventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = context.member!;
    const user = context.user!;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(eventId);
    if (!occ || occ.siteId !== siteId || occ.eventId !== anniversaryId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const body = await request.json();
    const { date, addImages, removeImages, images, description } = body;

    // Allow any member to add/remove images; restrict date edits to owner/admin
    if (date && !(occ.createdBy === user.userId || member.role === 'admin')) {
      return Response.json({ error: 'Forbidden (date edit)' }, { status: 403 });
    }

    // Build new images array if add/remove/images are provided
    let nextImageUrls: string[] | undefined = undefined;
    if (Array.isArray(images)) {
      nextImageUrls = images.filter((s) => typeof s === 'string' && s.length > 0);
    } else if (Array.isArray(addImages) || Array.isArray(removeImages)) {
      // Extract current URLs from imagesWithDimensions
      const currentImages = occ.imagesWithDimensions || [];
      const baseUrls = currentImages.map(img => img.url);
      const add = (Array.isArray(addImages) ? addImages : []).filter(Boolean) as string[];
      const del = new Set((Array.isArray(removeImages) ? removeImages : []) as string[]);
      nextImageUrls = [...baseUrls.filter((u) => !del.has(u)), ...add];
    }

    // Dimensions are only measured for URLs we do not already know (famcircle#196).
    //
    // extractImageDimensions fetches every URL it is given, one after another. Measuring
    // the whole list on every edit made REMOVAL unusable as soon as galleries got big:
    // dropping one photo from a 1041-image event (which the Dropbox folder import now
    // creates in one go) meant ~1040 sequential Storage fetches, and a single failure
    // threw the entire removal away on the line below. The dimensions of images already
    // on the event are stored beside their URLs, so a removal needs to measure NOTHING.
    let nextImagesWithDimensions: ImageWithDimension[] | undefined = undefined;
    if (nextImageUrls) {
      const known = new Map(
        (occ.imagesWithDimensions || []).map((img) => [img.url, img])
      );
      const unknownUrls = nextImageUrls.filter((url) => !known.has(url));

      if (unknownUrls.length > 0) {
        console.log('[anniversaries/events/update] Extracting dimensions for', unknownUrls.length, 'new image(s)');
      }
      const measured = unknownUrls.length > 0 ? await extractImageDimensions(unknownUrls) : [];
      const measuredByUrl = new Map(
        unknownUrls.map((url, i) => [url, measured[i]])
      );

      nextImagesWithDimensions = nextImageUrls.map((url) => {
        const existing = known.get(url);
        if (existing) return existing;

        const dim = measuredByUrl.get(url);
        if (!dim) {
          throw new Error(`Failed to extract dimensions for image ${url}`);
        }
        return { url, width: dim.width, height: dim.height };
      });
    }

    await occRepo.update(eventId, {
      date: date ? new Date(date) : undefined,
      imagesWithDimensions: nextImagesWithDimensions,
      description: typeof description === 'string' ? description : undefined,
    });
    const updated = await occRepo.getById(eventId);
    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (_request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string; eventId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;
    const eventId = params?.eventId;

    if (!siteId || !anniversaryId || !eventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = context.member!;
    const user = context.user!;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(eventId);
    if (!occ || occ.siteId !== siteId || occ.eventId !== anniversaryId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (occ.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await occRepo.delete(eventId);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
