import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { siteId } = params ?? {};
    const { signupRequestId } = await request.json();
    if (!signupRequestId || !siteId) {
      return Response.json({ error: 'Missing signupRequestId or siteId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    const signupRequest = await familyRepository.getSignupRequestById(signupRequestId);
    if (!signupRequest || signupRequest.siteId !== siteId) {
      return Response.json({ error: 'Signup request not found' }, { status: 404 });
    }
    await familyRepository.markSignupRequestRejected(signupRequestId);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to reject member' }, { status: 500 });
  }
};

export const POST = withAdminGuard(handler);
