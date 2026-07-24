import { withMemberGuard } from '@/lib/withMemberGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (_req: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { siteId } = params ?? {};
    if (!siteId) return Response.json({ error: 'Missing siteId' }, { status: 400 });
    const repo = new FamilyRepository();
    const count = await repo.countSiteMembers(siteId);
    return Response.json({ count });
  } catch (e) {
    console.error('members count error', e);
    return Response.json({ error: 'Failed to fetch members count' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);
