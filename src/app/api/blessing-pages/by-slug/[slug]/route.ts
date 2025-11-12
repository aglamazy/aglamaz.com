import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { slug } = params ?? {};

    // Get blessing page by slug
    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getBySlug(slug!);

    if (!blessingPage || blessingPage.siteId !== member.siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get event details
    const anniversaryRepo = new AnniversaryRepository();
    const event = await anniversaryRepo.getById(blessingPage.eventId);

    if (!event || event.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    return Response.json({ blessingPage, event });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch blessing page' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
