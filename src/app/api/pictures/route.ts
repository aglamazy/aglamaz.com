import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (_req: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const repo = new AnniversaryOccurrenceRepository();
    const items = await repo.listBySite(member.siteId);
    return Response.json({ items });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch pictures' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
