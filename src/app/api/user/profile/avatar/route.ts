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

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return Response.json({ error: 'missing_site' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const resolved = await resolveMember(siteId, userId);
    if (!resolved) {
      return Response.json({ error: 'member_not_found' }, { status: 404 });
    }

    let payload: any = null;
    try {
      payload = await request.json();
    } catch (error) {
      return Response.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const avatarUrl = typeof payload?.avatarUrl === 'string' ? payload.avatarUrl.trim() : '';
    const avatarStoragePath = typeof payload?.avatarStoragePath === 'string' ? payload.avatarStoragePath.trim() : '';

    if (!avatarUrl || !avatarStoragePath) {
      return Response.json({ error: 'missing_avatar' }, { status: 400 });
    }

    await resolved.repo.updateMember(resolved.member.id, {
      avatarUrl,
      avatarStoragePath,
    });

    const updated = await resolved.repo.getMemberById(resolved.member.id);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('[user/profile/avatar] update metadata failed', error);
    return Response.json({ error: 'upload_failed' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext) => {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return Response.json({ error: 'missing_site' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const resolved = await resolveMember(siteId, userId);
    if (!resolved) {
      return Response.json({ error: 'member_not_found' }, { status: 404 });
    }

    await resolved.repo.updateMember(resolved.member.id, {
      avatarUrl: null,
      avatarStoragePath: null,
    });

    const updated = await resolved.repo.getMemberById(resolved.member.id);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('[user/profile/avatar] delete failed', error);
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
};

export const POST = withUserGuard(postHandler);
export const DELETE = withUserGuard(deleteHandler);
