import { withUserGuard } from '@/lib/withUserGuard';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

async function resolveMember(siteId: string, userId: string) {
  const repo = new FamilyRepository();
  const member = await repo.getMemberByUserId(userId, siteId);
  if (!member) return null;
  return { repo, member } as const;
}

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolved = await resolveMember(siteId, userId);
    if (!resolved) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    return Response.json({ member: resolved.member });
  } catch (error) {
    console.error('[user/profile] failed to load member profile', error);
    return Response.json({ error: 'Failed to load member profile' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolved = await resolveMember(siteId, userId);
    if (!resolved) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, string> = {};

    if (typeof body.displayName === 'string') {
      const displayName = body.displayName.trim();
      if (!displayName) {
        return Response.json({ error: 'Display name is required' }, { status: 400 });
      }
      updates.displayName = displayName;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No updates provided' }, { status: 400 });
    }

    await resolved.repo.updateMember(resolved.member.id, updates);
    const updated = await resolved.repo.getMemberById(resolved.member.id);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('[user/profile] failed to update member profile', error);
    return Response.json({ error: 'Failed to update member profile' }, { status: 500 });
  }
};

export const GET = withUserGuard(getHandler);
export const PUT = withUserGuard(putHandler);
