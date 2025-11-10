import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');
    const now = new Date();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const repo = new AnniversaryRepository();
    // Push site-specific horizon forward and compute occurrences if needed
    await repo.ensureHebrewHorizonForYear(member.siteId, year);
    const events = await repo.getEventsForMonth(member.siteId, month, year);
    return Response.json({ events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const member = context.member!;
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl, useHebrew, deathDate, burialDate } = body;
    if (!name || !date || !type) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return Response.json({ error: 'Invalid date' }, { status: 400 });
    }
    const isDeathType = type === 'death' || type === 'death_anniversary';
    const parsedDeathDate = deathDate ? new Date(deathDate) : parsedDate;
    if (isDeathType && Number.isNaN(parsedDeathDate.getTime())) {
      return Response.json({ error: 'Invalid death date' }, { status: 400 });
    }
    const parsedBurialDate = burialDate ? new Date(burialDate) : undefined;
    if (useHebrew && isDeathType) {
      if (!parsedBurialDate || Number.isNaN(parsedBurialDate.getTime())) {
        return Response.json({ error: 'Invalid burial date' }, { status: 400 });
      }
      if (parsedBurialDate.getTime() < parsedDeathDate.getTime()) {
        return Response.json({ error: 'Burial date must not precede death date' }, { status: 400 });
      }
    }
    const repo = new AnniversaryRepository();
    const event = await repo.create({
      siteId: member.siteId,
      ownerId: user.userId,
      name,
      description,
      type,
      date: parsedDate,
      deathDate: isDeathType ? parsedDeathDate : undefined,
      burialDate: isDeathType ? parsedBurialDate : undefined,
      isAnnual: Boolean(isAnnual),
      createdBy: user.userId,
      imageUrl,
      useHebrew: Boolean(useHebrew),
    });
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
