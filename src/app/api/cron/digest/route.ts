// Digest cron: compile and push to Listmonk for each site.
// Schedule (vercel.json):
//   Monthly: 0 6 1 * *   → /api/cron/digest              (month-in-review, previous month)
//   Weekly:  0 6 * * 1   → /api/cron/digest?cadence=weekly (rolling 28-day forward window)
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { ConfigRepository } from '@/repositories/ConfigRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { NotificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ListmonkService } from '@/services/ListmonkService';
import { TranslationService } from '@/services/TranslationService';
import { getMostRecentFieldVersion, normalizeLang } from '@/services/LocalizationService';
import type { ISite } from '@/entities/Site';

export const dynamic = 'force-dynamic';

const SOURCE_LOCALE = 'he';

function getPreviousMonth(reference: Date): { month: number; year: number } {
  const startOfMonthUtc = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  startOfMonthUtc.setUTCMonth(startOfMonthUtc.getUTCMonth() - 1);
  return {
    month: startOfMonthUtc.getUTCMonth(),
    year: startOfMonthUtc.getUTCFullYear(),
  };
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

function formatListmonkLocale(locale: string): string {
  return locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
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

  const { searchParams } = new URL(request.url);
  const cadence = searchParams.get('cadence') ?? 'monthly';

  if (cadence !== 'weekly' && cadence !== 'monthly') {
    return NextResponse.json({ error: `Invalid cadence: ${cadence}` }, { status: 400 });
  }

  const siteRepo = new SiteRepository();
  const configRepo = new ConfigRepository();
  const memberRepo = new MemberRepository();
  const notifPrefsRepo = new NotificationPreferencesRepository();
  const digestCompiler = new DigestCompilerService();
  const listmonk = new ListmonkService();

  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/digest] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  const now = new Date();

  // Monthly: previous calendar month; weekly: today through 28 days forward
  const { month, year } = getPreviousMonth(now);
  const weeklyFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weeklyTo = new Date(weeklyFrom.getTime() + 28 * 24 * 60 * 60 * 1000);

  let created = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      const site = await siteRepo.get(siteId);
      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      // Check whether this site has any members subscribed to the requested cadence.
      const members = await memberRepo.listActiveMembers(siteId);
      if (!members.length) continue;

      const memberPrefs = await Promise.all(members.map(m => notifPrefsRepo.get(m.id, siteId)));

      if (cadence === 'weekly') {
        const hasWeeklyMembers = memberPrefs.some(p => p.magazineCadence === 'weekly');
        if (!hasWeeklyMembers) continue;
      } else {
        // monthly: include members whose cadence is 'monthly' (explicit or default) — skip 'weekly' and 'none'
        const hasMonthlyMembers = memberPrefs.some(p => p.magazineCadence === 'monthly');
        if (!hasMonthlyMembers) continue;
      }

      const targetLocale = resolveTargetLocale(site);
      if (!targetLocale) {
        throw new Error(`Unable to resolve digest locale for site ${siteId}`);
      }

      const siteName = resolveDigestSiteName(site, targetLocale, siteId);
      const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const siteUrl = rawAppUrl ? rawAppUrl.replace(/\/+$/, '') : undefined;
      const intlLocale = formatListmonkLocale(targetLocale);

      let campaignName: string;
      let template: { subject: string; html: string; text: string };
      let campaignTags: string[];

      if (cadence === 'weekly') {
        const compiled = await digestCompiler.compileRollingWindowDigest(siteId, weeklyFrom, weeklyTo, { locale: SOURCE_LOCALE });
        template = DigestTemplateService.buildWeeklyDigestEmail(compiled, {
          locale: SOURCE_LOCALE,
          siteName,
          siteUrl,
        });
        const weekLabel =
          new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' }).format(weeklyFrom) +
          ' – ' +
          new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' }).format(weeklyTo);
        campaignName = `${siteName} weekly digest ${weekLabel}`;
        campaignTags = ['weekly-digest'];
      } else {
        const compiled = await digestCompiler.compileDigest(siteId, month, year, { locale: SOURCE_LOCALE });
        template = DigestTemplateService.buildMonthlyDigestEmail(compiled, {
          locale: SOURCE_LOCALE,
          siteName,
          siteUrl,
        });
        const monthLabel = new Intl.DateTimeFormat(intlLocale, {
          month: 'long',
          year: 'numeric',
        }).format(new Date(year, month, 1));
        campaignName = `${siteName} digest ${monthLabel}`;
        campaignTags = ['monthly-digest'];
      }

      const localized = await maybeTranslateDigest({
        subject: template.subject,
        html: template.html,
        text: template.text,
        from: SOURCE_LOCALE,
        to: targetLocale,
      });

      const listId = await configRepo.getListmonkListId(siteId);
      const campaign = await listmonk.createCampaign({
        listId,
        name: campaignName,
        subject: localized.subject,
        body: localized.html,
        altBody: localized.text,
        tags: campaignTags,
      });
      await listmonk.setCampaignStatus(campaign.id, 'running');

      created++;
      console.log(
        `[cron/digest] campaign running: cadence=${cadence} site=${siteId} campaign=${campaign.id} list=${listId} locale=${targetLocale}`,
      );
    } catch (err) {
      failed++;
      console.error(`[cron/digest] error processing site ${siteId} (cadence=${cadence}):`, err);
    }
  }

  console.log(`[cron/digest] complete: cadence=${cadence} sites=${siteIds.length} created=${created} failed=${failed}`);
  return NextResponse.json({ ok: true, cadence, sites: siteIds.length, created, failed });
}
