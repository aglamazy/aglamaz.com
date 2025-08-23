import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import type { IMember } from '@/entities/Member';
import { userNotificationService } from '@/services/UserNotificationService';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const { id } = context.params;
    const { signupRequestId } = await request.json();
    if (!signupRequestId) {
      return Response.json({ error: 'Missing signupRequestId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    // Fetch the signup request
    const signupRequest = await familyRepository.getSignupRequestById(signupRequestId);
    if (!signupRequest) {
      return Response.json({ error: 'Signup request not found' }, { status: 404 });
    }
    // Create the member object
    const newMember: Partial<IMember> = {
      uid: signupRequest.userId || '',
      siteId: signupRequest.siteId,
      role: 'member',
      displayName: signupRequest.firstName || '',
      firstName: signupRequest.firstName || '',
      email: signupRequest.email,
    };
    // Save the member
    const created = await familyRepository.createMember(newMember);
    // Mark the signup request as approved
    await familyRepository.markSignupRequestApproved(signupRequestId);
    // Send welcome email to the new member
    await userNotificationService.sendWelcomeEmail({
      firstName: created.firstName,
      email: created.email,
    });
    return Response.json({ member: created });
  } catch (error) {
    return Response.json({ error: 'Failed to approve member' }, { status: 500 });
  }
};

export const POST = withAdminGuard(handler); 
