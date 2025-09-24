import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const { id } = context.params!; // eventId
    const annRepo = new AnniversaryRepository();
    const occRepo = new AnniversaryOccurrenceRepository();

    const event = await annRepo.getById(id!);
    if (!event || event.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const items = await occRepo.listByEvent(id!);
    return Response.json({ events: items });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const { id } = context.params!; // eventId
    const body = await request.json();
    const { date, imageUrl, images, description } = body;
    if (!date) {
      return Response.json({ error: 'Missing date' }, { status: 400 });
    }
    const annRepo = new AnniversaryRepository();
    const occRepo = new AnniversaryOccurrenceRepository();
    const event = await annRepo.getById(id!);
    if (!event || event.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    // All members can create events (previously occurrences)
    const defaultDesc = typeof description === 'string' ? description : (event.description || '');
    const occ = await occRepo.create({ siteId: member.siteId, eventId: id!, date: new Date(date), createdBy: user.userId, imageUrl, images: Array.isArray(images) ? images : undefined, description: defaultDesc });
    return Response.json({ event: occ }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
