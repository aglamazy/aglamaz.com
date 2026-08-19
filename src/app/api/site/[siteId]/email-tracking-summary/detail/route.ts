import { withAdminGuard } from '@/lib/withAdminGuard';
import { emailTrackingDetailService } from '@/services/EmailTrackingSummaryService';
import { isEmailTrackingSendType } from '@/services/EmailTrackingService';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId) {
    return Response.json({ error: 'Site ID is required' }, { status: 400 });
  }
  if (context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sendType = searchParams.get('sendType');
  const sendId = searchParams.get('sendId');
  if (!isEmailTrackingSendType(sendType)) {
    return Response.json({ error: 'Invalid or missing sendType' }, { status: 400 });
  }
  if (!sendId) {
    return Response.json({ error: 'sendId is required' }, { status: 400 });
  }

  const recipients = await emailTrackingDetailService.getRecipientDetailForSend(siteId, sendType, sendId);
  return Response.json({ recipients });
};

export const GET = withAdminGuard(handler);
