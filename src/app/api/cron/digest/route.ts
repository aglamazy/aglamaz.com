// Digest cron: compile a digest per member's magazineCadence preference and send it
// directly (per-member, via Resend) - not a single site-wide Listmonk campaign.
// Per docs/family-digest-formats-spec.md §1: cadence is a per-member choice
// ('weekly' | 'monthly' | 'none'), resolved at send time, from ONE shared route.
// Four cron entries point at this same route (see vercel.json) - a burst of 7 fires every
// 10 minutes for an hour after the base time, not spread across the day (Agla, 2026-07-24
// - the "3 of 11" incident: any single run can be interrupted by a deploy cutover, timeout,
// or partial failure; DigestSendRepository's per-period dedup makes this cheap - each
// later fire is a near-no-op for whoever already got it, "broadcast" only reaches
// whoever's still missing, so tight retries converge to 100% within the hour):
//   - "0,10,20,30,40,50 0 1 * *" + "0 1 1 * *"   -> monthly (default, no query param): 00:00-01:00 UTC on the 1st
//   - "0,10,20,30,40,50 6 * * 5" + "0 7 * * 5"   -> weekly (rolling window): 06:00-07:00 UTC Friday
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { SiteRepository } from '@/repositories/SiteRepository';
import { digestSendRepository, periodKeyFor } from '@/repositories/DigestSendRepository';
import { resolveDigestRecipients } from '@/services/DigestSendPlanService';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { TranslationService } from '@/services/TranslationService';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';
import type { UnifiedMagazineCadence } from '@/repositories/NotificationPreferencesRepository';

export const dynamic = 'force-dynamic';

const SOURCE_LOCALE = 'he';

type SendableCadence = Exclude<UnifiedMagazineCadence, 'none'>;

function resolveCadence(request: NextRequest): SendableCadence {
  return request.nextUrl.searchParams.get('cadence') === 'weekly' ? 'weekly' : 'monthly';
}

/** Optional single-recipient scope for manual real-path verification (avoids emailing the whole site). */
function resolveMemberIdFilter(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('memberId');
}

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

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/digest] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteRepo = new SiteRepository();
  const digestCompiler = new DigestCompilerService();
  const cadence = resolveCadence(request);
  const memberIdFilter = resolveMemberIdFilter(request);

  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/digest] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  const now = new Date();
  const period = periodKeyFor(cadence, now);

  let sent = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      // Idempotency (Agla, 2026-07-24 - the "3 of 11" incident): this cron is scheduled to
      // fire multiple times per period specifically so an interrupted run (deploy cutover,
      // timeout, partial failure) gets picked up by the next fire - onlyUnsent filters out
      // already-sent members, so re-running is always safe and never double-sends. Locale
      // resolution (member.defaultLocale -> site.defaultLocale, no further guess) lives in
      // resolveDigestRecipients - shared with the admin preview endpoint.
      const { site, recipients } = await resolveDigestRecipients(siteId, cadence, period, {
        onlyUnsent: true,
        memberIdFilter,
      });

      if (recipients.length === 0) {
        // Nobody left to send to this run (either no one wants this cadence, or everyone
        // who does already got it this period) - skip compiling entirely.
        continue;
      }

      // Per-site canonical domain, not the cron request's runtime host - a request against
      // localhost or a Vercel preview deployment must never bake that host into a sent link.
      const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
      const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);

      // Always resolve the name in SOURCE_LOCALE, matching the rest of the digest body
      // (which is compiled+rendered in SOURCE_LOCALE below).
      const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
      // Only the range computation differs between cadences - see CadenceDigestPayload's
      // doc comment (Agla, 2026-07-21 DRY correction).
      const digest =
        cadence === 'monthly'
          ? await digestCompiler.compileMonthlyDigest(siteId, now, { locale: SOURCE_LOCALE })
          : await digestCompiler.compileWeeklyDigest(siteId, now, { locale: SOURCE_LOCALE });

      // Built per-member (not once per site): the greeting names the actual recipient,
      // and each member may read in a different locale (mirrors InDayReminderService's
      // existing per-member personalization). Parallel, not sequential (Agla, 2026-07-24):
      // a serial loop over many recipients widens the window a deploy cutover or timeout
      // can cut it off in - Promise.allSettled sends everyone concurrently so the whole
      // batch finishes in roughly one send's time, not N.
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
          });
          await digestSendRepository.markSent(siteId, member.id, cadence, period);
        }),
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          console.error(`[cron/digest] error sending to member=${recipients[i].member.id} site=${siteId}:`, result.reason);
        }
      }

      console.log(
        `[cron/digest] sent: site=${siteId} cadence=${cadence} recipients=${recipients.length} siteDefaultLocale=${site.defaultLocale}`,
      );
    } catch (err) {
      failed++;
      console.error(`[cron/digest] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[cron/digest] complete: cadence=${cadence} sites=${siteIds.length} sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, cadence, sites: siteIds.length, sent, failed });
}
