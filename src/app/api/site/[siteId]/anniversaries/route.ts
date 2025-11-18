import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');
    const now = new Date();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // Get locale from header (injected by proxy from query param)
    const locale = request.headers.get('x-locale') || undefined;

    const repo = new AnniversaryRepository();
    // Push site-specific horizon forward and compute occurrences if needed
    await repo.ensureHebrewHorizonForYear(siteId, year);
    const events = await repo.getEventsForMonth(siteId, month, year, locale);
    return Response.json({ events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = context.user!;
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl, useHebrew } = body;
    if (!name || !date || !type) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Get locale from header (injected by proxy from query param)
    const locale = request.headers.get('x-locale') || 'he';

    const repo = new AnniversaryRepository();
    const event = await repo.create({
      siteId,
      ownerId: user.userId,
      name,
      description,
      type,
      date: new Date(date),
      isAnnual: Boolean(isAnnual),
      createdBy: user.userId,
      imageUrl,
      useHebrew: Boolean(useHebrew),
      locale,
    });
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create event' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
