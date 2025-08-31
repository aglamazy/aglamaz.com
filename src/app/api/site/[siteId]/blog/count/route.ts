import { withMemberGuard } from '@/lib/withMemberGuard';
import type { GuardContext } from '@/app/api/types';
import { BlogRepository } from '@/repositories/BlogRepository';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, { params }: GuardContext & { params: { siteId: string } }) => {
  try {
    const repo = new BlogRepository();
    const siteId = params.siteId;
    const now = new Date();
    const since = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const count = await repo.countPublicSince(siteId, Timestamp.fromDate(since));
    return Response.json({ count });
  } catch (error) {
    console.error('Failed to count blog posts', error);
    return Response.json({ error: 'Failed to count blog posts' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);

