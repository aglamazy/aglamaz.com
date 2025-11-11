import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const handler = async (_req: Request, context: GuardContext & { params: Promise<{ memberId: string }> }) => {
  try {
    const params = await context.params;
    const { memberId } = params || {};
    const requester = context.member!;
    if (!memberId) {
      return Response.json({ error: 'Missing memberId' }, { status: 400 });
    }

    const repo = new FamilyRepository();
    const member = await repo.getMemberById(memberId);

    if (!member || member.siteId !== requester.siteId) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    return Response.json({
      member: {
        id: member.id,
        displayName: member.displayName || member.firstName || '',
        email: member.email || '',
        role: member.role,
        avatarUrl: member.avatarUrl || null,
        createdAt: member.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error('[members/id] failed to load member', error);
    return Response.json({ error: 'Failed to fetch member' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);
