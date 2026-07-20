// Monthly cron: compile a digest for each site and push it to Listmonk.
// Schedule: 0 6 1 * * (06:00 UTC on the first day of the month) — configured in vercel.json.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { ConfigRepository } from '@/repositories/ConfigRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
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
  const configRepo = new ConfigRepository();
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
  const { month, year } = getPreviousMonth(now);

  let created = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      const site = await siteRepo.get(siteId);
      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      const targetLocale = resolveTargetLocale(site);
      if (!targetLocale) {
        throw new Error(`Unable to resolve digest locale for site ${siteId}`);
      }

      const compiled = await digestCompiler.compileDigest(siteId, month, year, { locale: SOURCE_LOCALE });
      const siteName = resolveDigestSiteName(site, targetLocale, siteId);
      const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const siteUrl = rawAppUrl ? rawAppUrl.replace(/\/+$/, '') : undefined;
      const template = DigestTemplateService.buildMonthlyDigestEmail(compiled, {
        locale: SOURCE_LOCALE,
        siteName,
        siteUrl,
      });
      const localized = await maybeTranslateDigest({
        subject: template.subject,
        html: template.html,
        text: template.text,
        from: SOURCE_LOCALE,
        to: targetLocale,
      });
      const listId = await configRepo.getListmonkListId(siteId);
      const monthLabel = new Intl.DateTimeFormat(targetLocale === 'he' ? 'he-IL' : targetLocale === 'tr' ? 'tr-TR' : 'en-US', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, month, 1));

      const campaign = await listmonk.createCampaign({
        listId,
        name: `${siteName} digest ${monthLabel}`,
        subject: localized.subject,
        body: localized.html,
        altBody: localized.text,
        tags: ['monthly-digest'],
      });
      await listmonk.setCampaignStatus(campaign.id, 'running');

      created++;
      console.log(
        `[cron/digest] campaign running: site=${siteId} campaign=${campaign.id} list=${listId} locale=${targetLocale}`,
      );
    } catch (err) {
      failed++;
      console.error(`[cron/digest] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[cron/digest] complete: sites=${siteIds.length} created=${created} failed=${failed}`);
  return NextResponse.json({ ok: true, sites: siteIds.length, created, failed });
}
