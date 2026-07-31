// Shared "build the preview section HTML" logic - used by BOTH the manual on-demand button
// (digest-preview-send/route.ts) and the automatic 24h-before cron (cron/digest-preview/
// route.ts), so the two paths can never drift into showing different content for what is
// supposed to be the same preview (Agla 2026-07-27).
import type { DigestCadence } from '@/repositories/DigestSendRepository';
import { periodKeyFor } from '@/repositories/DigestSendRepository';
import { resolveDigestRecipients, SiteDefaultLocaleMissingError } from '@/services/DigestSendPlanService';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { escapeHtml } from '@/services/emailTemplates';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';

export { SiteDefaultLocaleMissingError };

const SOURCE_LOCALE = 'he';

export interface DigestPreviewResult {
  section: string;
  recipientCount: number;
}

export async function buildDigestPreviewSection(
  siteId: string,
  cadence: DigestCadence,
  referenceDate: Date,
  contextLine: string,
): Promise<DigestPreviewResult> {
  const digestCompiler = new DigestCompilerService();
  const period = periodKeyFor(cadence, referenceDate);
  const { site, recipients } = await resolveDigestRecipients(siteId, cadence, period, { onlyUnsent: false });

  const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
  const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);
  const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
  const digest =
    cadence === 'monthly'
      ? await digestCompiler.compileMonthlyDigest(siteId, referenceDate, { locale: SOURCE_LOCALE })
      : await digestCompiler.compileWeeklyDigest(siteId, referenceDate, { locale: SOURCE_LOCALE });
  // No real recipient here (admin-facing "what would this look like" preview) - the
  // /app/* links in this rendering aren't meant to be functional for anyone specific,
  // so there's no real member to mint a read-only token for.
  const template =
    cadence === 'weekly'
      ? DigestTemplateService.buildWeeklyDigestEmail(digest, { locale: SOURCE_LOCALE, siteName, recipientName: '(recipient name)', calendarUrl, galleryUrl, readOnlyToken: '' })
      : DigestTemplateService.buildMonthlyDigestEmail(digest, { locale: SOURCE_LOCALE, siteName, recipientName: '(recipient name)', calendarUrl, galleryUrl, readOnlyToken: '' });

  const recipientRows = recipients.length
    ? recipients
        .map((r) => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(r.member.email || '')}</td><td style="padding:4px 12px 4px 0">${escapeHtml(r.locale)}</td><td style="padding:4px 0;color:#888">${r.localeSource === 'member' ? 'member preference' : 'site default'}</td></tr>`)
        .join('')
    : '<tr><td colspan="3" style="padding:4px 0;color:#888">No one wants this cadence right now.</td></tr>';

  // Email clients (Gmail included) strip <iframe> from HTML mail outright, so the magazine
  // content silently vanished when embedded that way - splice in the actual rendered
  // content instead of iframing the full standalone document. Grabbing the whole <body>
  // also duplicated the digest's own header banner/card frame/footer inside this preview's
  // frame ("double email" look) - take just the .content region.
  const contentStart = template.html.indexOf('<div class="content"');
  const footerStart = contentStart >= 0 ? template.html.indexOf('<div class="footer"', contentStart) : -1;
  const contentHtml =
    contentStart >= 0 && footerStart > contentStart
      ? template.html.slice(contentStart, footerStart)
      : template.html;

  const section = `
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

  return { section, recipientCount: recipients.length };
}
