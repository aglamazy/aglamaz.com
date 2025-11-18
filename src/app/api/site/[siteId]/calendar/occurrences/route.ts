import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (req: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return Response.json({ error: 'Invalid year/month' }, { status: 400 });
    }
    // Use UTC month boundaries to avoid server timezone skew
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
    const repo = new AnniversaryOccurrenceRepository();
    const items = await repo.listBySiteAndRange(siteId, start, end);
    return Response.json({ items });
  } catch (error) {
    console.error('[calendar][occurrences] error', error);
    return Response.json({ error: 'Failed to fetch occurrences' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
