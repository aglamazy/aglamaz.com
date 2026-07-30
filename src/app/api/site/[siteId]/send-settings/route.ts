// F7-A (famcircle#119): admin-facing read/write for the ONE table every send route checks
// before firing (SiteRepository.resolveSendSettings/updateSendSetting) - no shadow config,
// what this endpoint returns/writes is literally what the 4 cron routes read.
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { SiteRepository } from '@/repositories/SiteRepository';
import { SEND_TYPES, type SendType } from '@/entities/Site';

export const dynamic = 'force-dynamic';

const siteRepository = new SiteRepository();

function isSendType(value: unknown): value is SendType {
  return typeof value === 'string' && (SEND_TYPES as readonly string[]).includes(value);
}

const getHandler = async (_request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const enabledByType = await siteRepository.getSendSettings(siteId);
  const sendTypes = SEND_TYPES.map((type) => ({ type, enabled: enabledByType[type] }));

  return Response.json({ sendTypes });
};

const postHandler = async (request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, enabled } = (body ?? {}) as { type?: unknown; enabled?: unknown };
  if (!isSendType(type)) {
    return Response.json({ error: `type must be one of: ${SEND_TYPES.join(', ')}` }, { status: 400 });
  }
  if (typeof enabled !== 'boolean') {
    return Response.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  await siteRepository.updateSendSetting(siteId, type, enabled);
  const enabledByType = await siteRepository.getSendSettings(siteId);
  const sendTypes = SEND_TYPES.map((t) => ({ type: t, enabled: enabledByType[t] }));

  return Response.json({ sendTypes });
};

export const GET = withAdminGuard(getHandler);
export const POST = withAdminGuard(postHandler);
