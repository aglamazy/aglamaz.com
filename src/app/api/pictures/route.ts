import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (_req: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const occRepo = new AnniversaryOccurrenceRepository();
    const items = await occRepo.listBySite(member.siteId);
    // Attach minimal event summaries (name) to reduce client round-trips
    const annRepo = new AnniversaryRepository();
    const ids = Array.from(new Set(items.map((i: any) => i.eventId).filter(Boolean)));
    const events: Record<string, { name: string }> = {};
    for (const id of ids) {
      try {
        const ev = await annRepo.getById(id);
        if (ev) events[id] = { name: ev.name };
      } catch {}
    }
    return Response.json({ items, events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch pictures' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
