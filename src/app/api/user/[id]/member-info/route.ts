import { FamilyRepository } from '@/repositories/FamilyRepository';
import { withUserGuard } from "@/lib/withUserGuard";
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const { id } = context.params!;
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) {
      return Response.json({ error: 'Missing required field: siteId' }, { status: 400 });
    }
    const familyRepository = new FamilyRepository();
    const memberInfo = await familyRepository.getMemberByUserId(id, siteId);
    if (!memberInfo) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }
    return Response.json({ success: true, member: memberInfo });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch member info' }, { status: 500 });
  }
};

export const GET = withUserGuard(handler);
