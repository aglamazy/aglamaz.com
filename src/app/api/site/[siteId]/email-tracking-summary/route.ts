import { withAdminGuard } from '@/lib/withAdminGuard';
import { emailTrackingSummaryService } from '@/services/EmailTrackingSummaryService';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (_request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId) {
    return Response.json({ error: 'Site ID is required' }, { status: 400 });
  }
  if (context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sends = await emailTrackingSummaryService.getSummaryForSite(siteId);
  return Response.json({ sends });
};

export const GET = withAdminGuard(handler);
