// Digest cron: compile a digest per member's magazineCadence preference and send it
// directly (per-member, via Resend) - not a single site-wide Listmonk campaign.
// Per docs/family-digest-formats-spec.md §1: cadence is a per-member choice
// ('weekly' | 'monthly' | 'none'), resolved at send time, from ONE shared route.
// Two cron schedules point at this same route (see vercel.json):
//   - "0 6 1 * *"                    -> monthly cadence (default, no query param)
//   - "0 6 * * 1?cadence=weekly"     -> weekly cadence (rolling window)
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { TranslationService } from '@/services/TranslationService';
import { getMostRecentFieldVersion, normalizeLang } from '@/services/LocalizationService';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';
import type { ISite } from '@/entities/Site';
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

function resolveTargetLocale(site: ISite): string | null {
  const candidates = [
    getMostRecentFieldVersion(site, 'name')?.locale,
    getMostRecentFieldVersion(site, 'aboutFamily')?.locale,
    ...Object.keys(site.locales || {}),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLang(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
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
  const memberRepo = new MemberRepository();
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

  let sent = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      const site = await siteRepo.get(siteId);
      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      const members = await memberRepo.listActiveMembers(siteId);
      const prefs = await Promise.all(members.map((m) => notificationPreferencesRepository.get(m.id, siteId)));
      let recipients = members.filter((member, i) => prefs[i].magazineCadence === cadence && !!member.email);
      if (memberIdFilter) {
        recipients = recipients.filter((member) => member.id === memberIdFilter);
      }

      if (recipients.length === 0) {
        // Nobody on this site wants this cadence's send this run - skip compiling entirely.
        continue;
      }

      // Per-site canonical domain, not the cron request's runtime host - a request against
      // localhost or a Vercel preview deployment must never bake that host into a sent link.
      const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
      const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);

      const siteDefaultLocale = resolveTargetLocale(site);
      if (!siteDefaultLocale) {
        throw new Error(`Unable to resolve digest locale for site ${siteId}`);
      }

      // Always resolve the name in SOURCE_LOCALE, matching the rest of the digest body
      // (which is compiled+rendered in SOURCE_LOCALE below) - siteDefaultLocale is a loose
      // "whatever locale this site has any data in" guess (any stray locales.* key can hijack
      // it) and using it here produced a mixed-language digest when the site had an
      // unexpected locale key present (Agla, 2026-07-21: "mixed Arabic Hebrew").
      const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
      // Only the range computation differs between cadences - see CadenceDigestPayload's
      // doc comment (Agla, 2026-07-21 DRY correction).
      const digest =
        cadence === 'monthly'
          ? await digestCompiler.compileMonthlyDigest(siteId, now, { locale: SOURCE_LOCALE })
          : await digestCompiler.compileWeeklyDigest(siteId, now, { locale: SOURCE_LOCALE });

      // Built per-member (not once per site): the greeting names the actual recipient,
      // and each member may read in a different locale (mirrors InDayReminderService's
      // existing per-member personalization).
      for (const member of recipients) {
        try {
          const recipientLocale = normalizeLang(member.defaultLocale) ?? siteDefaultLocale;
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
          sent++;
        } catch (memberErr) {
          failed++;
          console.error(`[cron/digest] error sending to member=${member.id} site=${siteId}:`, memberErr);
        }
      }

      console.log(
        `[cron/digest] sent: site=${siteId} cadence=${cadence} recipients=${recipients.length} locale=${siteDefaultLocale}`,
      );
    } catch (err) {
      failed++;
      console.error(`[cron/digest] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[cron/digest] complete: cadence=${cadence} sites=${siteIds.length} sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, cadence, sites: siteIds.length, sent, failed });
}
