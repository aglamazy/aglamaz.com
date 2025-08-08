import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';

const putHandler = async (request: Request, { params }: any, user: any, member: any) => {
  try {
    const repo = new AnniversaryRepository();
    const existing = await repo.getById(params.id);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.uid) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl } = body;
    await repo.update(params.id, {
      name,
      description,
      type,
      date: date ? new Date(date) : undefined,
      isAnnual: isAnnual !== undefined ? Boolean(isAnnual) : undefined,
      imageUrl,
    });
    const updated = await repo.getById(params.id);
    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, { params }: any, user: any, member: any) => {
  try {
    const repo = new AnniversaryRepository();
    const existing = await repo.getById(params.id);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.uid) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(params.id);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
