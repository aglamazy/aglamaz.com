import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import type { IMember } from '@/entities/Member';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const { siteId } = context.params!;
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    const members = await familyRepository.getSiteMembers(siteId);
    // Map FamilyMember to IMember
    const mapped = members.map(m => ({
      ...m,
      uid: m.userId,
      displayName: m.firstName || '',
    })) as IMember[];
    return Response.json({ members: mapped });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch site members' }, { status: 500 });
  }
};

export const GET = withAdminGuard(handler);
