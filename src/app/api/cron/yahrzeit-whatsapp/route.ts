// Yahrzeit-day synchronized WhatsApp send.
// Fires daily at 07:00 UTC — one hour after the email-reminder cron.
// Finds every yahrzeit occurring TODAY across all sites and sends an
// identical WhatsApp to every active family member simultaneously.
//
// Delivery is gated on WABA being configured (famcircle#28).
// Member phone numbers come from whatever interface famcircle#28 introduces;
// until then the service logs a no-op for every send attempt.

import { NextRequest, NextResponse } from 'next/server';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { WhatsAppSendsRepository } from '@/repositories/WhatsAppSendsRepository';
import { YahrzeitWhatsAppService } from '@/services/YahrzeitWhatsAppService';
import type { ISite } from '@/entities/Site';

export const dynamic = 'force-dynamic';

function getSiteName(site: ISite): string {
  if (site.name) return site.name;
  for (const locale of ['he', 'en', 'tr']) {
    const n = site.locales?.[locale]?.name;
    if (n) return n;
  }
  return '';
}

function getSiteUrl(_site: ISite): string {
  // TODO (famcircle#28): derive per-tenant URL once custom domain routing is stored on ISite.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  return base || '';
}

// Returns the member's phone number once famcircle#28 stores it.
// Until then, returns null and the send is skipped.
function getMemberPhone(member: Record<string, unknown>): string | null {
  // TODO (famcircle#28): read member.whatsappPhone or equivalent field
  // once the WABA opt-in layer stores it.
  return (member.whatsappPhone as string | undefined) ?? null;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/yahrzeit-whatsapp] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const annivRepo = new AnniversaryRepository();
  const memberRepo = new MemberRepository();
  const siteRepo = new SiteRepository();
  const sendsRepo = new WhatsAppSendsRepository();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = today.getMonth();
  const year = today.getFullYear();
  const day = today.getDate();

  let totalSent = 0;
  let totalSkipped = 0;
  let totalNoPhone = 0;
  let sites: ISite[] = [];

  try {
    sites = await siteRepo.listAll();
  } catch (err) {
    console.error('[cron/yahrzeit-whatsapp] failed to list sites:', err);
    return NextResponse.json({ error: 'Failed to list sites' }, { status: 500 });
  }

  for (const site of sites) {
    const siteId = site.id;
    const familyName = getSiteName(site);
    const siteUrl = getSiteUrl(site);

    try {
      await annivRepo.ensureHebrewHorizonForYear(siteId, year);

      const events = await annivRepo.getEventsForMonth(siteId, month, year);

      // Only yahrzeit events falling on today's Gregorian date
      const todayYahrzeits = events.filter(
        (ev) => ev.type === 'death' && ev.month === month && ev.day === day,
      );

      if (todayYahrzeits.length === 0) continue;

      const members = await memberRepo.listActiveMembers(siteId);

      for (const member of members) {
        const phone = getMemberPhone(member as Record<string, unknown>);

        // TODO (famcircle#11): check member opt-out before sending.
        // if (prefs?.yahrzeitWaOptOut) continue;

        for (const ev of todayYahrzeits) {
          try {
            const alreadySent = await sendsRepo.hasSent(member.id, ev.id, year, 'yahrzeit_wa');
            if (alreadySent) {
              totalSkipped++;
              continue;
            }

            if (!phone) {
              totalNoPhone++;
              console.log(
                `[cron/yahrzeit-whatsapp] no phone: member=${member.id} event=${ev.id} — awaiting famcircle#28`,
              );
              // Mark sent to avoid repeating log every day after WABA is live
              // but before member has enrolled. Remove this once opt-in flow is built.
              // Do NOT mark sent — we want to retry once the member has a phone.
              continue;
            }

            const lang = member.defaultLocale ?? 'he';
            const body = YahrzeitWhatsAppService.buildMessage({
              eventName: ev.name,
              familyName,
              siteUrl,
              lang,
            });

            console.log(
              `[cron/yahrzeit-whatsapp] sending: site=${siteId} member=${member.id} event="${ev.name}"`,
            );

            const result = await YahrzeitWhatsAppService.sendMessage(phone, body);

            if (result.sent) {
              await sendsRepo.markSent({
                memberId: member.id,
                eventId: ev.id,
                siteId,
                year,
                topic: 'yahrzeit_wa',
              });
              totalSent++;
            } else {
              console.warn(
                `[cron/yahrzeit-whatsapp] not sent: member=${member.id} event=${ev.id} reason=${result.reason}`,
              );
            }
          } catch (memberErr) {
            console.error(
              `[cron/yahrzeit-whatsapp] error: member=${member.id} event=${ev.id}:`,
              memberErr,
            );
          }
        }
      }
    } catch (err) {
      console.error(`[cron/yahrzeit-whatsapp] error processing site ${siteId}:`, err);
    }
  }

  console.log(
    `[cron/yahrzeit-whatsapp] complete: sites=${sites.length} sent=${totalSent} skipped=${totalSkipped} no_phone=${totalNoPhone}`,
  );
  return NextResponse.json({
    ok: true,
    sites: sites.length,
    sent: totalSent,
    skipped: totalSkipped,
    noPhone: totalNoPhone,
  });
}
