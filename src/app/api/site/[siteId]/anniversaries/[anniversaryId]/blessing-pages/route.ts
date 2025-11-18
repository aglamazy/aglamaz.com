import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
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

    // Verify the event exists and belongs to the site
    const anniversaryRepo = new AnniversaryRepository();
    const event = await anniversaryRepo.getById(anniversaryId);
    if (!event || event.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get all blessing pages for this event
    const repo = new BlessingPageRepository();
    const blessingPages = await repo.listByEvent(anniversaryId);

    return Response.json({ blessingPages });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch blessing pages' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
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

    const user = context.user!;
    const member = context.member!;

    // Verify the event exists and belongs to the site
    const anniversaryRepo = new AnniversaryRepository();
    const event = await anniversaryRepo.getById(anniversaryId);
    if (!event || event.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await request.json();
    const { year } = body;

    if (!year || typeof year !== 'number') {
      return Response.json({ error: 'Year is required' }, { status: 400 });
    }

    // Create or get existing blessing page
    const repo = new BlessingPageRepository();
    const blessingPage = await repo.create({
      eventId: anniversaryId,
      siteId: siteId,
      year,
      createdBy: user.userId,
    });

    return Response.json({ blessingPage }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create blessing page' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
