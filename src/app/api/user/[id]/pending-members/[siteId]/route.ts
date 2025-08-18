import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: any, user: any, member: any) => {
  try {
    const { siteId } = context.params;
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    const pendingMembers = await familyRepository.getPendingSignupRequests(siteId);
    return Response.json({ data: pendingMembers });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch pending members' }, { status: 500 });
  }
};

export const GET = withAdminGuard(handler); 