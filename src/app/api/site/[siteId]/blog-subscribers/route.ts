import { withAdminGuard } from '@/lib/withAdminGuard';
import { blogSubscriberRepository } from '@/repositories/BlogSubscriberRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (_request: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { siteId } = params ?? {};
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const subscribers = await blogSubscriberRepository.getBySite(siteId);
    return Response.json({ data: subscribers });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch blog subscribers' }, { status: 500 });
  }
};

export const GET = withAdminGuard(handler);
