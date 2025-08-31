import { withMemberGuard } from '@/lib/withMemberGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (_req: Request, context: GuardContext) => {
  try {
    const { siteId } = context.params!;
    if (!siteId) return Response.json({ error: 'Missing siteId' }, { status: 400 });
    const repo = new FamilyRepository();
    const members = await repo.getSiteMembers(siteId);
    const safe = members.map((m: any) => ({
      id: m.id,
      uid: m.userId || m.uid,
      displayName: m.firstName || m.displayName || '',
      email: m.email || '',
      role: m.role,
      blogHandle: m.blogHandle || null,
    }));
    return Response.json({ members: safe });
  } catch (e) {
    console.error('members public error', e);
    return Response.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);

