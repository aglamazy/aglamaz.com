import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const putHandler = async (request: Request, context: GuardContext & { params: { siteId: string; memberId: string } }) => {
  try {
    const { siteId, memberId } = context.params!;
    const repo = new FamilyRepository();
    const existing = await repo.getMemberById(memberId);
    if (!existing) return Response.json({ error: 'Member not found' }, { status: 404 });
    if ((existing as any).siteId !== siteId) return Response.json({ error: 'Invalid site' }, { status: 400 });

    const body = await request.json();
    const allowed: any = {};
    if (body.role && ['member', 'admin'].includes(body.role)) allowed.role = body.role;
    if (typeof body.blogEnabled === 'boolean') allowed.blogEnabled = body.blogEnabled;
    if (typeof body.blogHandle === 'string') allowed.blogHandle = body.blogHandle;
    if (typeof body.displayName === 'string') allowed.displayName = body.displayName;

    await repo.updateMember(memberId, allowed);
    const updated = await repo.getMemberById(memberId);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('Failed to update member', error);
    return Response.json({ error: 'Failed to update member' }, { status: 500 });
  }
};

const deleteHandler = async (_request: Request, context: GuardContext & { params: { siteId: string; memberId: string } }) => {
  try {
    const { siteId, memberId } = context.params!;
    const repo = new FamilyRepository();
    const existing = await repo.getMemberById(memberId);
    if (!existing) return Response.json({ error: 'Member not found' }, { status: 404 });
    if ((existing as any).siteId !== siteId) return Response.json({ error: 'Invalid site' }, { status: 400 });

    await repo.deleteMember(memberId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete member', error);
    return Response.json({ error: 'Failed to delete member' }, { status: 500 });
  }
};

export const PUT = withAdminGuard(putHandler);
export const DELETE = withAdminGuard(deleteHandler);

