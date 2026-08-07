import { withAdminGuard } from '@/lib/withAdminGuard';
import { loginAuditRepository } from '@/repositories/LoginAuditRepository';
import { digestSendRepository } from '@/repositories/DigestSendRepository';
import { emailTrackingRepository } from '@/repositories/EmailTrackingRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * Backing endpoint for the admin "usage data" surface (famcircle#148) - one place holding
 * BOTH the login journal AND email-pixel telemetry, so an admin doesn't have to check raw
 * Firestore to see who opened the digest. Digest opens/clicks are joined onto each
 * (cadence, period) send group by sendId (`${cadence}:${periodKey}`, the same id
 * DigestSendExecutionService signs into the tracking token) - real Firestore reads, not
 * derived/cached counts, so this reconciles exactly to emailTrackingEvents/digestSends.
 */
const handler = async (_request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId) {
    return Response.json({ error: 'Site ID is required' }, { status: 400 });
  }
  if (context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [entries, periods] = await Promise.all([
    loginAuditRepository.listBySite(siteId),
    digestSendRepository.listRecentPeriods(siteId),
  ]);

  const digestUsage = await Promise.all(
    periods.map(async (period) => {
      const events = await emailTrackingRepository.getEventsForSend(siteId, 'digest', `${period.cadence}:${period.periodKey}`);
      const opened = new Set(events.filter((e) => e.eventType === 'open').map((e) => e.recipientMemberId));
      const clicked = new Set(events.filter((e) => e.eventType === 'click').map((e) => e.recipientMemberId));
      return {
        cadence: period.cadence,
        periodKey: period.periodKey,
        sent: period.sent,
        opened: opened.size,
        clicked: clicked.size,
      };
    }),
  );

  return Response.json({ entries, digestUsage });
};

export const GET = withAdminGuard(handler);
