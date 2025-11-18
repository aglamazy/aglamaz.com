import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const resolveParams = async (context: GuardContext) =>
  (context.params instanceof Promise ? await context.params : context.params) ?? {};

const getHandler = async (_request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const { siteId } = await resolveParams(context);
    const repo = new FamilyRepository();
    const data = await repo.getPendingSignupRequests(siteId);
    return Response.json({ data });
  } catch (error) {
    console.error('[pending-members][GET] failed', error);
    return Response.json({ error: 'Failed to load pending members' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const { siteId } = await resolveParams(context);
    const body = await request.json();
    const action = body?.action as 'approve' | 'reject' | undefined;
    const signupRequestId = body?.signupRequestId as string | undefined;
    const reason = typeof body?.reason === 'string' ? body.reason : undefined;

    if (!action || !signupRequestId) {
      return Response.json({ error: 'Missing action or signupRequestId' }, { status: 400 });
    }

    const repo = new FamilyRepository();
    const actor = context.user?.sub || 'admin';
    await repo.processSignupRequest(signupRequestId, actor, action === 'approve', reason);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[pending-members][POST] failed', error);
    return Response.json({ error: 'Failed to update pending member' }, { status: 500 });
  }
};

export const GET = withAdminGuard(getHandler);
export const POST = withAdminGuard(postHandler);
