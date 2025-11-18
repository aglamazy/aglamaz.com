import { withMemberGuard } from '@/lib/withMemberGuard';
import type { GuardContext } from '@/app/api/types';
import { BlogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const params = context.params instanceof Promise ? await context.params : context.params;
    const siteId = params?.siteId;
    const count = await repo.countPublicBySite(siteId);
    return Response.json({ count });
  } catch (error) {
    console.error('Failed to count blog posts', error);
    return Response.json({ error: 'Failed to count blog posts' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
