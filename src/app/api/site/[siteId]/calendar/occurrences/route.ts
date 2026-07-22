import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (req: Request, context: GuardContext) => {
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

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return Response.json({ error: 'Invalid year/month' }, { status: 400 });
    }
    // Use UTC month boundaries to avoid server timezone skew
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
    const repo = new AnniversaryOccurrenceRepository();
    const items = await repo.listBySiteAndRange(siteId, start, end);

    // Denormalize the parent event's name onto each occurrence so callers never
    // need a separate, horizon-dependent events[] lookup to render a label -
    // the occurrence->event link is resolved directly by id here, same principle
    // as famcircle#4's originalDate fields.
    const locale = req.headers.get('x-locale') || undefined;
    const annRepo = new AnniversaryRepository();
    const eventIds = Array.from(new Set(items.map((item) => item.eventId)));
    const eventNameById = new Map<string, string>();
    await Promise.all(
      eventIds.map(async (eventId) => {
        const event = await annRepo.getById(eventId, locale);
        if (event) {
          eventNameById.set(eventId, event.name);
        }
      })
    );
    const itemsWithNames = items.map((item) => ({
      ...item,
      eventName: eventNameById.get(item.eventId),
    }));
    return Response.json({ items: itemsWithNames });
  } catch (error) {
    console.error('[calendar][occurrences] error', error);
    return Response.json({ error: 'Failed to fetch occurrences' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
