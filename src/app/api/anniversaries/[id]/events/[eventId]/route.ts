import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const { id } = context.params!;
    const occurrenceId = (context.params as any)?.eventId as string;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId!);
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
    const { id } = context.params!;
    const occurrenceId = (context.params as any)?.eventId as string;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const body = await request.json();
    const { date, imageUrl, addImages, removeImages, images, description } = body;

    // Allow any member to add/remove images; restrict date edits to owner/admin
    if (date && !(occ.createdBy === user.userId || member.role === 'admin')) {
      return Response.json({ error: 'Forbidden (date edit)' }, { status: 403 });
    }

    // Build new images array if add/remove/images are provided
    let nextImages: string[] | undefined = undefined;
    if (Array.isArray(images)) {
      nextImages = images.filter((s) => typeof s === 'string' && s.length > 0);
    } else if (Array.isArray(addImages) || Array.isArray(removeImages)) {
      const base: string[] = Array.isArray((occ as any).images) ? ((occ as any).images as string[]) : [];
      const add = (Array.isArray(addImages) ? addImages : []).filter(Boolean) as string[];
      const del = new Set((Array.isArray(removeImages) ? removeImages : []) as string[]);
      nextImages = [...base.filter((u) => !del.has(u)), ...add];
    }

    await occRepo.update(occurrenceId!, {
      date: date ? new Date(date) : undefined,
      imageUrl, // legacy
      images: nextImages,
      description: typeof description === 'string' ? description : undefined,
    });
    const updated = await occRepo.getById(occurrenceId!);
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
    const { id } = context.params!;
    const occurrenceId = (context.params as any)?.eventId as string;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (occ.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await occRepo.delete(occurrenceId!);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
