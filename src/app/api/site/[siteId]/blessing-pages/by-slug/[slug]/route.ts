import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; slug: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const slug = params?.slug;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!slug) {
      return Response.json({ error: 'Slug is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get blessing page by slug
    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getBySlug(slug);

    if (!blessingPage || blessingPage.siteId !== siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get event details
    const anniversaryRepo = new AnniversaryRepository();
    const event = await anniversaryRepo.getById(blessingPage.eventId);

    if (!event || event.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    return Response.json({ blessingPage, event });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch blessing page' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
