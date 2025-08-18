import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: any, user: any, member: any) => {
  try {
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const now = new Date();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth();
    const year = now.getFullYear();
    const repo = new AnniversaryRepository();
    const events = await repo.getEventsForMonth(member.siteId, month, year);
    return Response.json({ events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: any, user: any, member: any) => {
  try {
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl } = body;
    if (!name || !date || !type) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const repo = new AnniversaryRepository();
    const event = await repo.create({
      siteId: member.siteId,
      ownerId: user.uid,
      name,
      description,
      type,
      date: new Date(date),
      isAnnual: Boolean(isAnnual),
      createdBy: user.uid,
      imageUrl,
    });
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
