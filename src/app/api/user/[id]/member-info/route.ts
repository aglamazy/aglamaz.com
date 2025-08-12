import { FamilyRepository } from '@/repositories/FamilyRepository';
import {withMemberGuard} from "@/lib/withMemberGuard";

const handler = async (request: Request, context: any, user: any, member: any) => {
  try {
    const { id } = context.params;
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

export const GET = withMemberGuard(handler);