import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (req: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return Response.json({ error: 'Invalid year/month' }, { status: 400 });
    }
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const repo = new AnniversaryOccurrenceRepository();
    const items = await repo.listBySiteAndRange(member.siteId, start, end);
    return Response.json({ items });
  } catch (error) {
    console.error('[calendar][occurrences] error', error);
    return Response.json({ error: 'Failed to fetch occurrences' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);

