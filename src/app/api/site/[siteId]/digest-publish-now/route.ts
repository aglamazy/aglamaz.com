// Admin-triggered real digest send (Agla, 2026-07-24): sends the CURRENT cadence's digest
// to real recipients right now, via the same executeDigestSend path the scheduled cron
// uses. Deliberately ignores existing send-dedup (onlyUnsent: false) - this is the "second
// edition" action for when a corrected magazine needs to go out again even though the
// scheduled cron already sent a first (wrong) one - but it DOES record the send afterward,
// so the next scheduled cron run doesn't also re-send to these same people.
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { resolveDigestRecipients, SiteDefaultLocaleMissingError } from '@/services/DigestSendPlanService';
import { periodKeyFor } from '@/repositories/DigestSendRepository';
import { nextCadenceToFire } from '@/services/DigestScheduleService';
import { executeDigestSend } from '@/services/DigestSendExecutionService';

export const dynamic = 'force-dynamic';

const postHandler = async (_request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  // Same cadence choice as the "preview today's magazine" button, so what you previewed is
  // what you publish - not a separately-computed guess.
  const { cadence } = nextCadenceToFire(now);
  const period = periodKeyFor(cadence, now);

  try {
    const { site, recipients } = await resolveDigestRecipients(siteId, cadence, period, { onlyUnsent: false });
    const result = await executeDigestSend(siteId, cadence, period, now, site, recipients);
    return Response.json({ ok: true, cadence, period, recipients: recipients.length, ...result });
  } catch (error) {
    if (error instanceof SiteDefaultLocaleMissingError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('[digest-publish-now] failed to send', error);
    return Response.json({ error: 'Failed to send' }, { status: 500 });
  }
};

export const POST = withAdminGuard(postHandler);
