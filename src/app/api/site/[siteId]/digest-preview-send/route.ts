// Admin-triggered digest preview (Agla, 2026-07-24 - the "Arabic digest" incident): shows
// exactly who WOULD receive the digest and in which language, plus a rendered sample of the
// actual content, before the real cron sends anything. Sent to the invoking admin's own
// email, never to real recipients. Purely informational - never marks anyone as sent
// (DigestSendRepository is untouched here), so it can be re-run any number of times.
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { resolveDigestRecipients, SiteDefaultLocaleMissingError } from '@/services/DigestSendPlanService';
import { periodKeyFor, type DigestCadence } from '@/repositories/DigestSendRepository';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml, escapeHtml } from '@/services/emailTemplates';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';

export const dynamic = 'force-dynamic';

const SOURCE_LOCALE = 'he';

/** Next Friday 06:00 UTC - matches vercel.json's weekly burst window start. */
function nextWeeklyFireDate(now: Date): Date {
  const daysUntilFriday = (5 - now.getUTCDay() + 7) % 7;
  const burstStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFriday, 6, 0, 0));
  if (daysUntilFriday === 0 && now.getTime() >= burstStart.getTime()) {
    burstStart.setUTCDate(burstStart.getUTCDate() + 7);
  }
  return burstStart;
}

/** Next 1st-of-month 00:00 UTC - matches vercel.json's monthly burst window start. */
function nextMonthlyFireDate(now: Date): Date {
  const burstStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  if (now.getTime() >= burstStart.getTime()) {
    burstStart.setUTCMonth(burstStart.getUTCMonth() + 1);
  }
  return burstStart;
}

/**
 * Which cadence is actually next to fire - not "both, always" (that's what caused the
 * "duplicate" confusion Agla flagged: monthly's window contains weekly's, so showing both
 * unconditionally just repeats the same near-term events twice in one preview). Whichever
 * burst is chronologically closer is "the right one" - Thursday -> weekly (fires Friday),
 * day before the 1st -> monthly (fires the 1st), and this generalizes cleanly to any day.
 */
function nextCadenceToFire(now: Date): { cadence: DigestCadence; fireDate: Date } {
  const weeklyFire = nextWeeklyFireDate(now);
  const monthlyFire = nextMonthlyFireDate(now);
  return weeklyFire.getTime() <= monthlyFire.getTime()
    ? { cadence: 'weekly', fireDate: weeklyFire }
    : { cadence: 'monthly', fireDate: monthlyFire };
}

const postHandler = async (_request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const adminEmail = context.member?.email as string | undefined;
  if (!adminEmail) {
    return Response.json({ error: 'Admin has no email on file' }, { status: 400 });
  }

  const digestCompiler = new DigestCompilerService();
  const { cadence, fireDate } = nextCadenceToFire(new Date());
  let section: string;

  try {
    const period = periodKeyFor(cadence, fireDate);
    const { site, recipients } = await resolveDigestRecipients(siteId, cadence, period, { onlyUnsent: false });

    const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
    const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);
    const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
    const digest =
      cadence === 'monthly'
        ? await digestCompiler.compileMonthlyDigest(siteId, fireDate, { locale: SOURCE_LOCALE })
        : await digestCompiler.compileWeeklyDigest(siteId, fireDate, { locale: SOURCE_LOCALE });
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

    section = `
        <h2 style="margin-top:32px">${cadence === 'weekly' ? 'Weekly' : 'Monthly'} digest - period ${escapeHtml(period)} (next send: ${fireDate.toISOString()})</h2>
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
    subject: '🔍 FamCircle digest preview',
    html,
    lang: 'en',
  });

  return Response.json({ ok: true, sentTo: adminEmail });
};

export const POST = withAdminGuard(postHandler);
