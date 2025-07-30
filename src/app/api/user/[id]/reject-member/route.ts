import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';

const handler = async (request: Request, context: any, user: any, member: any) => {
  try {
    const { id } = context.params;
    const { signupRequestId } = await request.json();
    if (!signupRequestId) {
      return Response.json({ error: 'Missing signupRequestId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    // Mark the signup request as rejected
    await familyRepository.markSignupRequestRejected(signupRequestId);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to reject member' }, { status: 500 });
  }
};

export const POST = withAdminGuard(handler); 