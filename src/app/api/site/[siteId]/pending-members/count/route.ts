import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (_req: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { siteId } = params ?? {};
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const familyRepository = new FamilyRepository();
    const count = await familyRepository.countPendingMembers(siteId);
    return Response.json({ count });
  } catch (error) {
    console.error('pending members count error', error);
    return Response.json({ error: 'Failed to fetch pending members count' }, { status: 500 });
  }
};

export const GET = withAdminGuard(handler);
