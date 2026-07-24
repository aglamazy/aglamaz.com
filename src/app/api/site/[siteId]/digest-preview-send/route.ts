// Admin-triggered digest preview (Agla, 2026-07-24 - the "Arabic digest" incident): shows
// exactly who WOULD receive the digest and in which language, plus a rendered sample of the
// actual content, before the real cron sends anything. Sent to the invoking admin's own
// email, never to real recipients. Purely informational - never marks anyone as sent
// (DigestSendRepository is untouched here), so it can be re-run any number of times.
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { resolveDigestRecipients, SiteDefaultLocaleMissingError } from '@/services/DigestSendPlanService';
import { periodKeyFor } from '@/repositories/DigestSendRepository';
import { nextCadenceToFire } from '@/services/DigestScheduleService';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml, escapeHtml } from '@/services/emailTemplates';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';

export const dynamic = 'force-dynamic';

const SOURCE_LOCALE = 'he';

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

  const digestCompiler = new DigestCompilerService();
  const now = new Date();
  const { cadence, fireDate } = nextCadenceToFire(now);
  const referenceDate = asOf === 'now' ? now : fireDate;
  let section: string;

  try {
    const period = periodKeyFor(cadence, referenceDate);
    const { site, recipients } = await resolveDigestRecipients(siteId, cadence, period, { onlyUnsent: false });

    const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
    const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);
    const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
    const digest =
      cadence === 'monthly'
        ? await digestCompiler.compileMonthlyDigest(siteId, referenceDate, { locale: SOURCE_LOCALE })
        : await digestCompiler.compileWeeklyDigest(siteId, referenceDate, { locale: SOURCE_LOCALE });
    const template =
      cadence === 'weekly'
        ? DigestTemplateService.buildWeeklyDigestEmail(digest, { locale: SOURCE_LOCALE, siteName, recipientName: '(recipient name)', calendarUrl, galleryUrl })
        : DigestTemplateService.buildMonthlyDigestEmail(digest, { locale: SOURCE_LOCALE, siteName, recipientName: '(recipient name)', calendarUrl, galleryUrl });

    const recipientRows = recipients.length
      ? recipients
          .map((r) => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(r.member.email || '')}</td><td style="padding:4px 12px 4px 0">${escapeHtml(r.locale)}</td><td style="padding:4px 0;color:#888">${r.localeSource === 'member' ? 'member preference' : 'site default'}</td></tr>`)
          .join('')
      : '<tr><td colspan="3" style="padding:4px 0;color:#888">No one wants this cadence right now.</td></tr>';

    // Email clients (Gmail included) strip <iframe> from HTML mail outright, so the
    // magazine content silently vanished when embedded that way - splice in the actual
    // rendered content instead of iframing the full standalone document. Grabbing the
    // whole <body> also duplicated the digest's own header banner/card frame/footer
    // inside this preview's frame ("double email" look) - take just the .content region.
    const contentStart = template.html.indexOf('<div class="content"');
    const footerStart = contentStart >= 0 ? template.html.indexOf('<div class="footer"', contentStart) : -1;
    const contentHtml =
      contentStart >= 0 && footerStart > contentStart
        ? template.html.slice(contentStart, footerStart)
        : template.html;

    const contextLine =
      asOf === 'now'
        ? `Showing what would be sent <strong>right now</strong> (${now.toISOString()}) if this cadence were triggered this instant - not the scheduled rehearsal.`
        : `Rehearsing the real send scheduled for <strong>${fireDate.toISOString()}</strong> - edit anything that looks wrong, then re-send this preview to check the fix before it goes out.`;

    section = `
        <h2 style="margin-top:32px">${cadence === 'weekly' ? 'Weekly' : 'Monthly'} digest - period ${escapeHtml(period)}</h2>
        <p>${contextLine}</p>
        <p><strong>${recipients.length}</strong> would receive this:</p>
        <table style="border-collapse:collapse;font-size:14px">
          <thead><tr><th style="text-align:start;padding:4px 12px 4px 0">Email</th><th style="text-align:start;padding:4px 12px 4px 0">Locale</th><th style="text-align:start;padding:4px 0">Source</th></tr></thead>
          <tbody>${recipientRows}</tbody>
        </table>
        <p style="margin-top:16px"><strong>Content preview</strong> (rendered in ${SOURCE_LOCALE} - real per-recipient sends translate this into each recipient's locale above):</p>
        <div style="border:1px solid #ddd;border-radius:8px;overflow:hidden">
          ${contentHtml}
        </div>
      `;
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
