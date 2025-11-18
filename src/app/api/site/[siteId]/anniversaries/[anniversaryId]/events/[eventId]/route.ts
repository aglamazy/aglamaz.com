import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { extractImageDimensions } from '@/utils/imageDimensions';
import type { ImageWithDimension } from '@/entities/ImageWithDimension';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id, eventId } = params ?? {};
    const occurrenceId = eventId as string | undefined;
    if (!id || !occurrenceId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    return Response.json({ event: occ });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id, eventId } = params ?? {};
    const occurrenceId = eventId as string | undefined;
    if (!id || !occurrenceId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
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

    // Extract dimensions if we have new images
    let nextImagesWithDimensions: ImageWithDimension[] | undefined = undefined;
    if (nextImageUrls && nextImageUrls.length > 0) {
      console.log('[anniversaries/events/update] Extracting dimensions for', nextImageUrls.length, 'images');
      const dimensions = await extractImageDimensions(nextImageUrls);
      nextImagesWithDimensions = nextImageUrls.map((url, index) => {
        const dim = dimensions[index];
        if (!dim) {
          throw new Error(`Failed to extract dimensions for image at index ${index}`);
        }
        return {
          url,
          width: dim.width,
          height: dim.height
        };
      });
    }

    await occRepo.update(occurrenceId, {
      date: date ? new Date(date) : undefined,
      imagesWithDimensions: nextImagesWithDimensions,
      description: typeof description === 'string' ? description : undefined,
    });
    const updated = await occRepo.getById(occurrenceId);
    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id, eventId } = params ?? {};
    const occurrenceId = eventId as string | undefined;
    if (!id || !occurrenceId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (occ.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await occRepo.delete(occurrenceId);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
