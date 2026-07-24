import { withAdminGuard } from '@/lib/withAdminGuard';
import { loginAuditRepository } from '@/repositories/LoginAuditRepository';
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

  const entries = await loginAuditRepository.listBySite(siteId);
  return Response.json({ entries });
};

export const GET = withAdminGuard(handler);
