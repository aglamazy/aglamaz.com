// Daily cron: same-day nudge for members whose family calendar has an occurrence TODAY
// (birthday, death/yahrzeit, or wedding anniversary) - silent on every other day.
// Schedule: 10 6 * * * (06:10 UTC) — configured in vercel.json.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.
// Per docs/family-digest-formats-spec.md §2 - unified single toggle (inDayRemindersEnabled),
// no per-topic granularity. This is a NEW mechanism, not an extension of the lead-time
// src/app/api/cron/reminders/route.ts (which §5 of the spec retires).

import { NextRequest, NextResponse } from 'next/server';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { ResendService } from '@/services/ResendService';
import { planInDaySends, filterTodaysOccurrences } from '@/services/InDayReminderService';
import {
  buildReminderPreferenceLink,
  signReminderPreferenceToken,
} from '@/services/ReminderPreferenceLinkService';
import { AppRoute, getPath } from '@/utils/urls';
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

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/in-day-reminders] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const annivRepo = new AnniversaryRepository();
  const memberRepo = new MemberRepository();
  const siteRepo = new SiteRepository();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendarUrl = new URL(getPath(AppRoute.APP_CALENDAR), request.nextUrl.origin).toString();
  // Optional single-recipient scope for manual real-path verification (avoids emailing the whole site).
  const memberIdFilter = request.nextUrl.searchParams.get('memberId');

  let totalSent = 0;
  let sites: ISite[] = [];

  try {
    sites = await siteRepo.listAll();
  } catch (err) {
    console.error('[cron/in-day-reminders] failed to list sites:', err);
    return NextResponse.json({ error: 'Failed to list sites' }, { status: 500 });
  }

  for (const site of sites) {
    const siteId = site.id;
    try {
      await annivRepo.ensureHebrewHorizonForYear(siteId, today.getFullYear());
      const events = await annivRepo.getEventsForMonth(siteId, today.getMonth(), today.getFullYear());

      if (filterTodaysOccurrences(events, today).length === 0) {
        // Silent day for this site - skip member/prefs reads entirely.
        continue;
      }

      const siteName = getSiteName(site);
      let members = await memberRepo.listActiveMembers(siteId);
      if (memberIdFilter) {
        members = members.filter((m) => m.id === memberIdFilter);
      }
      const prefs = await Promise.all(members.map((m) => notificationPreferencesRepository.get(m.id, siteId)));

      const plans = planInDaySends({
        events,
        today,
        siteName,
        calendarUrl,
        members: members.map((m, i) => ({
          memberId: m.id,
          email: m.email,
          inDayRemindersEnabled: prefs[i].inDayRemindersEnabled,
          defaultLocale: m.defaultLocale,
          firstName: m.firstName,
          displayName: m.displayName,
        })),
        manageLinkFor: (memberId) =>
          buildReminderPreferenceLink(
            request.nextUrl.origin,
            signReminderPreferenceToken({ memberId, siteId, topic: 'birthday' }),
          ),
      });

      for (const plan of plans) {
        try {
          console.log(
            `[cron/in-day-reminders] sending: site=${siteId} member=${plan.memberId} to=${plan.to}`,
          );
          await ResendService.sendTransactionalEmail({
            to: plan.to,
            subject: plan.subject,
            html: plan.html,
            lang: plan.lang,
          });
          totalSent++;
        } catch (memberErr) {
          console.error(
            `[cron/in-day-reminders] error sending to member=${plan.memberId}:`,
            memberErr,
          );
        }
      }
    } catch (err) {
      console.error(`[cron/in-day-reminders] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[cron/in-day-reminders] complete: sites=${sites.length} sent=${totalSent}`);
  return NextResponse.json({ ok: true, sites: sites.length, sent: totalSent });
}
