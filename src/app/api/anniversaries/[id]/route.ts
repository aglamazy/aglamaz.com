import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const repo = new AnniversaryRepository();
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const existing = await repo.getById(id!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch blessing pages for this event
    const blessingPageRepo = new BlessingPageRepository();
    const blessingPages = await blessingPageRepo.listByEvent(id!);

    return Response.json({
      event: {
        ...existing,
        blessingPages: blessingPages.map(bp => ({ year: bp.year, slug: bp.slug }))
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const existing = await repo.getById(id!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl, useHebrew } = body;

    // Get locale from header (injected by proxy from query param)
    const locale = request.headers.get('x-locale') || 'he';

    await repo.update(id!, {
      name,
      description,
      type,
      date: date ? new Date(date) : undefined,
      isAnnual: isAnnual !== undefined ? Boolean(isAnnual) : undefined,
      imageUrl,
      useHebrew,
      locale,
    });
      const updated = await repo.getById(id!);
    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const existing = await repo.getById(id!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(id!);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
export const GET = withMemberGuard(getHandler);
