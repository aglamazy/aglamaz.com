// Admin-triggered digest preview (Agla, 2026-07-24 - the "Arabic digest" incident): shows
// exactly who WOULD receive the digest and in which language, plus a rendered sample of the
// actual content, before the real cron sends anything. Sent to the invoking admin's own
// email, never to real recipients. Purely informational - never marks anyone as sent
// (DigestSendRepository is untouched here), so it can be re-run any number of times.
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { nextCadenceToFire } from '@/services/DigestScheduleService';
import { buildDigestPreviewSection, SiteDefaultLocaleMissingError } from '@/services/DigestPreviewRenderer';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml } from '@/services/emailTemplates';

export const dynamic = 'force-dynamic';

const postHandler = async (request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const adminEmail = context.member?.email as string | undefined;
  if (!adminEmail) {
    return Response.json({ error: 'Admin has no email on file' }, { status: 400 });
  }

  // Two distinct questions an admin can ask, so two distinct anchors (Agla 2026-07-24):
  // 'scheduled' (default) = "what will actually be sent at the next real fire" - a dress
  // rehearsal, must use the future fireDate so edit -> re-fire -> next-day-send all agree.
  // 'now' = "what would go out if I sent this cadence right this second" - useful when
  // today's own scheduled window already passed but this period is still unsent (or you
  // just want to sanity-check current content without waiting for the schedule).
  const asOf = new URL(request.url).searchParams.get('asOf') === 'now' ? 'now' : 'scheduled';

  const now = new Date();
  const { cadence, fireDate } = nextCadenceToFire(now);
  const referenceDate = asOf === 'now' ? now : fireDate;
  let section: string;

  try {
    const contextLine =
      asOf === 'now'
        ? `Showing what would be sent <strong>right now</strong> (${now.toISOString()}) if this cadence were triggered this instant - not the scheduled rehearsal.`
        : `Rehearsing the real send scheduled for <strong>${fireDate.toISOString()}</strong> - edit anything that looks wrong, then re-send this preview to check the fix before it goes out.`;
    ({ section } = await buildDigestPreviewSection(siteId, cadence, referenceDate, contextLine));
  } catch (error) {
    if (error instanceof SiteDefaultLocaleMissingError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('[digest-preview-send] failed to build preview', error);
    return Response.json({ error: 'Failed to build preview' }, { status: 500 });
  }

  const subject = asOf === 'now' ? "🔍 FamCircle digest preview - today's magazine" : '🔍 FamCircle digest preview';

  const html = renderEmailHtml({
    subject: 'Digest preview - who would get it, and in which language',
    lang: 'en',
    dir: 'ltr',
    heading: '🔍 Digest preview',
    greeting: 'Preview requested from /admin/magazine-template',
    paragraphs: [section],
    footerLines: ['This is a preview only - no one else was emailed, and nothing was marked as sent.'],
  });

  await ResendService.sendTransactionalEmail({
    to: adminEmail,
    subject,
    html,
    lang: 'en',
  });

  return Response.json({ ok: true, sentTo: adminEmail });
};

export const POST = withAdminGuard(postHandler);
