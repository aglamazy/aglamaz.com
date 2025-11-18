import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!anniversaryId) {
      return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new AnniversaryRepository();
    const existing = await repo.getById(anniversaryId);

    if (!existing || existing.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch blessing pages for this event
    const blessingPageRepo = new BlessingPageRepository();
    const blessingPages = await blessingPageRepo.listByEvent(anniversaryId);

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

const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!anniversaryId) {
      return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;

    const existing = await repo.getById(anniversaryId);
    if (!existing || existing.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl, useHebrew } = body;

    // Get locale from header (injected by proxy from query param)
    const locale = request.headers.get('x-locale') || 'he';

    await repo.update(anniversaryId, {
      name,
      description,
      type,
      date: date ? new Date(date) : undefined,
      isAnnual: isAnnual !== undefined ? Boolean(isAnnual) : undefined,
      imageUrl,
      useHebrew,
      locale,
    });
    const updated = await repo.getById(anniversaryId);
    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!anniversaryId) {
      return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;

    const existing = await repo.getById(anniversaryId);
    if (!existing || existing.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(anniversaryId);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
export const GET = withMemberGuard(getHandler);
