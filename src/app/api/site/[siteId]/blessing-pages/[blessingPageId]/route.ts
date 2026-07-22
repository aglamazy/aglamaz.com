import { withAdminGuard } from '@/lib/withAdminGuard';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const patchHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; blessingPageId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const blessingPageId = params?.blessingPageId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!blessingPageId) {
      return Response.json({ error: 'Blessing Page ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { isPublic } = body;

    if (typeof isPublic !== 'boolean') {
      return Response.json({ error: 'isPublic (boolean) is required' }, { status: 400 });
    }

    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getById(blessingPageId);
    if (!blessingPage || blessingPage.siteId !== siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    const updated = await bpRepo.setPublic(blessingPageId, isPublic);

    return Response.json({ blessingPage: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update blessing page' }, { status: 500 });
  }
};

export const PATCH = withAdminGuard(patchHandler);
