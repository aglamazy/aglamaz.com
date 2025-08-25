import { withUserGuard } from "@/lib/withUserGuard";
import { GuardContext, RouteHandler } from "@/app/api/types";
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

const handler: RouteHandler = async (request: Request, context: GuardContext) => {
  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return Response.json({ error: 'Missing required field: siteId' }, { status: 400 });
    }

    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const familyRepository = new FamilyRepository();
    const member = await familyRepository.getMemberByUserId(userId, siteId);

    if (member) {
      if (['member', 'admin'].includes(member.role)) {
        return Response.json({ success: true, status: 'member', member });
      }
      return Response.json({ success: true, status: 'pending', member });
    }

    const signupRequest = await familyRepository.getSignupRequestByUserId(userId, siteId);
    if (signupRequest) {
      return Response.json({ success: true, status: 'pending', signupRequest });
    }

    return Response.json({ success: true, status: 'not_applied' });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch member info' }, { status: 500 });
  }
};

export const GET = withUserGuard(handler);

