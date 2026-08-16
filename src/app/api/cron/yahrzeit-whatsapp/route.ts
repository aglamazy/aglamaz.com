// Daily cron: send site-scoped WhatsApp yahrzeit broadcasts on the exact day.
// Schedule: 5 6 * * * (06:05 UTC) — configured in vercel.json.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { WhatsAppYahrzeitSendRepository } from '@/repositories/WhatsAppYahrzeitSendRepository';
import { WhatsAppService } from '@/services/WhatsAppService';
import { getBaseUrlForSite } from '@/utils/serverUrls';
import { getMostRecentFieldVersion, normalizeLang } from '@/services/LocalizationService';
import type { ISite } from '@/entities/Site';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { reportCronAuthFailure } from '@/lib/reportCronAuthFailure';

export const dynamic = 'force-dynamic';

function formatOccurrenceDate(month: number, day: number, year: number, lang: string): string {
  const date = new Date(year, month, day);
  const formatterLocale = lang === 'he' ? 'he-IL' : lang === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/yahrzeit-whatsapp] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    reportCronAuthFailure('/api/cron/yahrzeit-whatsapp');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    WhatsAppService.validateConfiguration();
  } catch (error) {
    console.error('[cron/yahrzeit-whatsapp] invalid WhatsApp configuration:', error);
    return NextResponse.json({ error: 'Server misconfiguration: WABA not configured' }, { status: 500 });
  }

  const siteRepo = new SiteRepository();
  const annivRepo = new AnniversaryRepository();
  const sentRepo = new WhatsAppYahrzeitSendRepository();

  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/yahrzeit-whatsapp] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      const site = await siteRepo.get(siteId);
      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      // F7-A (famcircle#119): the admin send-settings table is the ONE thing every send
      // route checks before firing.
      if (!siteRepo.resolveSendSettings(site).yahrzeitWhatsapp) {
        console.log(`[cron/yahrzeit-whatsapp] skipped (send-settings off): site=${siteId}`);
        continue;
      }

      const targetLocale = resolveTargetLocale(site);
      if (!targetLocale) {
        throw new Error(`Unable to resolve yahrzeit WhatsApp locale for site ${siteId}`);
      }

      await annivRepo.ensureHebrewHorizonForYear(siteId, today.getFullYear());

      const localizedSite = await siteRepo.get(siteId, targetLocale, { cached: true });
      if (!localizedSite) {
        throw new Error(`Unable to load localized site ${siteId}`);
      }

      const siteName = resolveDigestSiteName(localizedSite, targetLocale, siteId);
      const siteUrl = await getBaseUrlForSite(siteId);
      const events = await annivRepo.getEventsForMonth(siteId, today.getMonth(), today.getFullYear(), targetLocale);

      const yahrzeitEvents = events.filter((event) => {
        if (event.type !== 'death') {
          return false;
        }
        const occurrenceDate = new Date(today.getFullYear(), event.month, event.day);
        return occurrenceDate.getMonth() === today.getMonth() && occurrenceDate.getDate() === today.getDate();
      });

      if (yahrzeitEvents.length === 0) {
        continue;
      }

      for (const event of yahrzeitEvents) {
        const alreadySent = await sentRepo.hasSent(siteId, event.id, today.getFullYear());
        if (alreadySent) {
          skipped++;
          console.log(
            `[cron/yahrzeit-whatsapp] dedupe skip: site=${siteId} event=${event.id} year=${today.getFullYear()}`,
          );
          continue;
        }

        const occurrenceDate = formatOccurrenceDate(event.month, event.day, today.getFullYear(), targetLocale);

        const message = WhatsAppService.buildYahrzeitMessage({
          siteName,
          eventName: event.name,
          occurrenceDate,
          siteUrl,
          locale: targetLocale,
        });

        console.log(
          `[cron/yahrzeit-whatsapp] sending: site=${siteId} event="${event.name}" date=${occurrenceDate} locale=${targetLocale}`,
        );

        await WhatsAppService.sendYahrzeitBroadcast({
          siteId,
          siteName,
          eventId: event.id,
          eventName: event.name,
          occurrenceDate,
          siteUrl,
          locale: targetLocale,
          year: today.getFullYear(),
        });

        await sentRepo.markSent({
          siteId,
          eventId: event.id,
          year: today.getFullYear(),
          locale: targetLocale,
          message,
        });

        sent++;
      }
    } catch (error) {
      failed++;
      console.error(`[cron/yahrzeit-whatsapp] error processing site ${siteId}:`, error);
    }
  }

  console.log(
    `[cron/yahrzeit-whatsapp] complete: sites=${siteIds.length} sent=${sent} skipped=${skipped} failed=${failed}`,
  );
  return NextResponse.json({ ok: true, sites: siteIds.length, sent, skipped, failed });
}
