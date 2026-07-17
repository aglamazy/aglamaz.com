// Daily cron: compute due birthday/yahrzeit reminders across all sites, dedupe, send.
// Schedule: 0 6 * * * (06:00 UTC) — configured in vercel.json.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { ReminderSendsRepository } from '@/repositories/ReminderSendsRepository';
import { ResendService } from '@/services/ResendService';
import type { ISite } from '@/entities/Site';

export const dynamic = 'force-dynamic';

const BIRTHDAY_LOOKAHEAD_DAYS = 7;
const YAHRZEIT_LOOKAHEAD_DAYS = 30;

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonthsInRange(start: Date, end: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push({ month: cur.getMonth(), year: cur.getFullYear() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function formatOccurrenceDate(month: number, day: number, year: number, lang: string): string {
  const d = new Date(year, month, day);
  try {
    const loc = lang === 'he' ? 'he-IL' : lang === 'tr' ? 'tr-TR' : 'en-US';
    return d.toLocaleDateString(loc, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return d.toDateString();
  }
}

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
    console.error('[cron/reminders] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const annivRepo = new AnniversaryRepository();
  const memberRepo = new MemberRepository();
  const siteRepo = new SiteRepository();
  const sendsRepo = new ReminderSendsRepository();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthdayWindowEnd = addDays(today, BIRTHDAY_LOOKAHEAD_DAYS - 1);
  const yahrzeitWindowEnd = addDays(today, YAHRZEIT_LOOKAHEAD_DAYS - 1);

  const birthdayMonths = getMonthsInRange(today, birthdayWindowEnd);
  const yahrzeitMonths = getMonthsInRange(today, yahrzeitWindowEnd);

  let totalSent = 0;
  let totalSkipped = 0;
  let sites: ISite[] = [];

  try {
    sites = await siteRepo.listAll();
  } catch (err) {
    console.error('[cron/reminders] failed to list sites:', err);
    return NextResponse.json({ error: 'Failed to list sites' }, { status: 500 });
  }

  for (const site of sites) {
    const siteId = site.id;
    const siteName = getSiteName(site);

    try {
      // Extend Hebrew occurrence horizon to cover all lookahead years before querying
      const uniqueYears = new Set([
        ...birthdayMonths.map(m => m.year),
        ...yahrzeitMonths.map(m => m.year),
      ]);
      for (const year of uniqueYears) {
        await annivRepo.ensureHebrewHorizonForYear(siteId, year);
      }

      // Collect due reminders: { eventId, eventName, eventMonth, eventDay, occurrenceYear, topic }
      type DueReminder = {
        eventId: string;
        eventName: string;
        eventMonth: number;
        eventDay: number;
        occurrenceYear: number;
        topic: 'birthday' | 'yahrzeit';
      };
      const dueReminders: DueReminder[] = [];

      for (const { month, year } of birthdayMonths) {
        const events = await annivRepo.getEventsForMonth(siteId, month, year);
        for (const ev of events) {
          if (ev.type !== 'birthday') continue;
          // ev.month/ev.day are the occurrence month/day (Gregorian, possibly mapped from Hebrew)
          const evDate = new Date(year, ev.month, ev.day);
          if (evDate >= today && evDate <= birthdayWindowEnd) {
            dueReminders.push({
              eventId: ev.id,
              eventName: ev.name,
              eventMonth: ev.month,
              eventDay: ev.day,
              occurrenceYear: year,
              topic: 'birthday',
            });
          }
        }
      }

      for (const { month, year } of yahrzeitMonths) {
        const events = await annivRepo.getEventsForMonth(siteId, month, year);
        for (const ev of events) {
          if (ev.type !== 'death') continue;
          const evDate = new Date(year, ev.month, ev.day);
          if (evDate >= today && evDate <= yahrzeitWindowEnd) {
            dueReminders.push({
              eventId: ev.id,
              eventName: ev.name,
              eventMonth: ev.month,
              eventDay: ev.day,
              occurrenceYear: year,
              topic: 'yahrzeit',
            });
          }
        }
      }

      if (dueReminders.length === 0) continue;

      const members = await memberRepo.listActiveMembers(siteId);

      for (const member of members) {
        if (!member.email) continue;

        // TODO (famcircle#11): load notification preferences for this member.
        // When the notificationPreferences collection lands, check per-member opt-out:
        // const prefs = await notificationPrefsRepo.getByMember(member.id, siteId);
        // No prefs doc = subscribed to both (documented default).
        // Expected shape: { birthOptOut: boolean; deathOptOut: boolean }

        for (const reminder of dueReminders) {
          try {
            // TODO (famcircle#11): apply opt-out before sending.
            // if (reminder.topic === 'birthday' && prefs?.birthOptOut) continue;
            // if (reminder.topic === 'yahrzeit' && prefs?.deathOptOut) continue;

            const alreadySent = await sendsRepo.hasSent(
              member.id,
              reminder.eventId,
              reminder.occurrenceYear,
              reminder.topic,
            );
            if (alreadySent) {
              totalSkipped++;
              console.log(
                `[cron/reminders] dedup skip: member=${member.id} event=${reminder.eventId} year=${reminder.occurrenceYear} topic=${reminder.topic}`,
              );
              continue;
            }

            const lang = member.defaultLocale ?? 'he';
            const dir = lang === 'he' ? 'rtl' : 'ltr';
            const occurrenceDate = formatOccurrenceDate(
              reminder.eventMonth,
              reminder.eventDay,
              reminder.occurrenceYear,
              lang,
            );

            // TODO (famcircle#11): replace placeholder with the real notification-preferences management URL
            const manageLink = '#manage-reminders';

            const { subject, html } = ResendService.buildReminderEmailHtml({
              topic: reminder.topic,
              firstName: member.firstName || member.displayName || member.email,
              eventName: reminder.eventName,
              occurrenceDate,
              manageLink,
              lang,
              dir,
              siteName,
            });

            console.log(
              `[cron/reminders] sending: site=${siteId} member=${member.email} topic=${reminder.topic} event="${reminder.eventName}" date=${occurrenceDate}`,
            );

            await ResendService.sendTransactionalEmail({ to: member.email, subject, html, lang });

            await sendsRepo.markSent({
              memberId: member.id,
              eventId: reminder.eventId,
              siteId,
              year: reminder.occurrenceYear,
              topic: reminder.topic,
            });

            totalSent++;
          } catch (memberErr) {
            console.error(
              `[cron/reminders] error sending to member=${member.id} topic=${reminder.topic} event=${reminder.eventId}:`,
              memberErr,
            );
          }
        }
      }
    } catch (err) {
      console.error(`[cron/reminders] error processing site ${siteId}:`, err);
    }
  }

  console.log(
    `[cron/reminders] complete: sites=${sites.length} sent=${totalSent} skipped=${totalSkipped}`,
  );
  return NextResponse.json({ ok: true, sites: sites.length, sent: totalSent, skipped: totalSkipped });
}
