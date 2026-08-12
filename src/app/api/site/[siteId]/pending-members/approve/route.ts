import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import type { IMember } from '@/entities/Member';
import { userNotificationService } from '@/services/UserNotificationService';
import { GuardContext } from '@/app/api/types';
import { actorFromClaims } from '@/auth/tokens';

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
    // Fetch the signup request
    const signupRequest = await familyRepository.getSignupRequestById(signupRequestId);
    if (!signupRequest || signupRequest.siteId !== siteId) {
      return Response.json({ error: 'Signup request not found' }, { status: 404 });
    }
    // Admin override: a signup can be approved even if the user never completed
    // email verification (missing userId) - this is the escape hatch for stuck
    // signups. The resulting member has no linked uid until the user signs in.
    const newMember: Partial<IMember> = {
      uid: signupRequest.userId || '',
      siteId: signupRequest.siteId,
      role: 'member',
      displayName: signupRequest.firstName || '',
      firstName: signupRequest.firstName || '',
      email: signupRequest.email,
    };
    // Save the member
    const created = await familyRepository.createMember(newMember, actorFromClaims(context.user!));
    // Mark the signup request as approved
    await familyRepository.markSignupRequestApproved(signupRequestId);
    // Send welcome email to the new member
    await userNotificationService.sendWelcomeEmail({
      firstName: created.firstName,
      email: created.email,
      siteId: created.siteId,
      locale: signupRequest.language || undefined,
    });
    return Response.json({ member: created });
  } catch (error) {
    return Response.json({ error: 'Failed to approve member' }, { status: 500 });
  }
};

export const POST = withAdminGuard(handler);
