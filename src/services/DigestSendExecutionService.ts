// The one real "compile + build + translate + send + markSent" path for a digest cadence -
// extracted from /api/cron/digest so the scheduled cron AND the admin-triggered publish-now
// action (Agla, 2026-07-24) share the exact same send logic. Two callers hand-rolling their
// own copy is exactly the drift that caused the "Arabic digest" incident at the
// recipient/locale-resolution layer - not repeating that mistake at the send layer too.
import type { ISite } from '@/entities/Site';
import type { DigestCadence } from '@/repositories/DigestSendRepository';
import { digestSendRepository } from '@/repositories/DigestSendRepository';
import type { DigestRecipientPlan } from '@/services/DigestSendPlanService';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { TranslationService } from '@/services/TranslationService';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';

const SOURCE_LOCALE = 'he';

function getHtmlLang(locale: string): string {
  return locale === 'he' ? 'he' : locale === 'tr' ? 'tr' : 'en';
}

function getHtmlDir(locale: string): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

function rewriteHtmlRootAttributes(html: string, locale: string): string {
  return html.replace(/<html[^>]*>/i, `<html lang="${getHtmlLang(locale)}" dir="${getHtmlDir(locale)}">`);
}

async function maybeTranslateDigest(params: {
  subject: string;
  html: string;
  text: string;
  from: string;
  to: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const { subject, html, text, from, to } = params;
  if (from === to) {
    return { subject, html, text };
  }

  if (!TranslationService.isEnabled()) {
    throw new Error(`Translation service disabled, cannot translate digest from ${from} to ${to}`);
  }

  const translated = await TranslationService.translateHtml({
    title: subject,
    content: html,
    from,
    to,
  });
  const translatedText = await TranslationService.translateText({
    text,
    from,
    to,
  });

  return {
    subject: translated.title,
    html: rewriteHtmlRootAttributes(translated.content, to),
    text: translatedText ?? text,
  };
}

export interface DigestSendExecutionResult {
  sent: number;
  failed: number;
  errors: Array<{ memberId: string; error: unknown }>;
}

/**
 * Sends the given cadence's digest to the given (already-resolved) recipients and marks
 * each successful send in DigestSendRepository. Caller decides who's in `recipients` -
 * this function doesn't dedup or filter, it just sends and records. `referenceDate` drives
 * the compiled content's past/coming windows (see DigestCompilerService).
 */
export async function executeDigestSend(
  siteId: string,
  cadence: DigestCadence,
  period: string,
  referenceDate: Date,
  site: ISite,
  recipients: DigestRecipientPlan[],
): Promise<DigestSendExecutionResult> {
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const digestCompiler = new DigestCompilerService();
  // Per-site canonical domain, not the caller's runtime host - a request against localhost
  // or a Vercel preview deployment must never bake that host into a sent link.
  const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
  const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);
  const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
  const digest =
    cadence === 'monthly'
      ? await digestCompiler.compileMonthlyDigest(siteId, referenceDate, { locale: SOURCE_LOCALE })
      : await digestCompiler.compileWeeklyDigest(siteId, referenceDate, { locale: SOURCE_LOCALE });

  // Built per-member (not once per site): the greeting names the actual recipient, and
  // each member may read in a different locale. Parallel, not sequential (Agla,
  // 2026-07-24): a serial loop over many recipients widens the window a deploy cutover or
  // timeout can cut it off in - Promise.allSettled sends everyone concurrently.
  const results = await Promise.allSettled(
    recipients.map(async ({ member, locale: recipientLocale }) => {
      const recipientName = member.firstName || member.displayName || member.email;
      const template =
        cadence === 'weekly'
          ? DigestTemplateService.buildWeeklyDigestEmail(digest, {
              locale: SOURCE_LOCALE,
              siteName,
              recipientName,
              calendarUrl,
              galleryUrl,
            })
          : DigestTemplateService.buildMonthlyDigestEmail(digest, {
              locale: SOURCE_LOCALE,
              siteName,
              recipientName,
              calendarUrl,
              galleryUrl,
            });

      const localized = await maybeTranslateDigest({
        subject: template.subject,
        html: template.html,
        text: template.text,
        from: SOURCE_LOCALE,
        to: recipientLocale,
      });

      await ResendService.sendTransactionalEmail({
        to: member.email,
        subject: localized.subject,
        html: localized.html,
        lang: recipientLocale,
        tracking: {
          origin: new URL(calendarUrl).origin,
          siteId,
          recipientMemberId: member.id,
          sendType: 'digest',
          sendId: `${cadence}:${period}`,
        },
      });
      await digestSendRepository.markSent(siteId, member.id, cadence, period);
    }),
  );

  let sent = 0;
  let failed = 0;
  const errors: Array<{ memberId: string; error: unknown }> = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      sent++;
    } else {
      failed++;
      errors.push({ memberId: recipients[i].member.id, error: result.reason });
    }
  }

  return { sent, failed, errors };
}
