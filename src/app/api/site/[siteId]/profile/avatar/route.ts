import { withUserGuard } from '@/lib/withUserGuard';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) {
      return Response.json({ error: 'missing_site' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const repo = new FamilyRepository();
    const member = await repo.getMemberByUserId(userId, siteId);
    if (!member) {
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

    await repo.updateMember(member.id, {
      avatarUrl,
      avatarStoragePath,
    });

    const updated = await repo.getMemberById(member.id);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('[site/profile/avatar] update metadata failed', error);
    return Response.json({ error: 'upload_failed' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) {
      return Response.json({ error: 'missing_site' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const repo = new FamilyRepository();
    const member = await repo.getMemberByUserId(userId, siteId);
    if (!member) {
      return Response.json({ error: 'member_not_found' }, { status: 404 });
    }

    await repo.updateMember(member.id, {
      avatarUrl: null,
      avatarStoragePath: null,
    });

    const updated = await repo.getMemberById(member.id);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('[site/profile/avatar] delete failed', error);
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
};

export const POST = withUserGuard(postHandler);
export const DELETE = withUserGuard(deleteHandler);
