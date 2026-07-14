import { NextRequest, NextResponse } from 'next/server';
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { ReminderRepository, reminderSendId, ReminderTopic } from '@/repositories/ReminderRepository';
import { sendTransactionalEmail } from '@/services/ResendService';
import { isOptedOut } from '@/services/NotificationPreferencesService';
import { isEventDue, monthYearPairsInWindow, startOfDay, YAHRZEIT_LOOKAHEAD_DAYS } from '@/services/ReminderComputationService';
import type { AnniversaryEvent } from '@/entities/Anniversary';

export const dynamic = 'force-dynamic';

function verifyCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return false;
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${expected}`) {
    return true;
  }
  const querySecret = request.nextUrl.searchParams.get('secret');
  return querySecret === expected;
}

interface DueReminder {
  event: AnniversaryEvent;
  topic: ReminderTopic;
  occurrenceYear: number;
}

async function computeDueReminders(siteId: string, today: Date): Promise<DueReminder[]> {
  const anniversaryRepo = new AnniversaryRepository();
  const pairs = monthYearPairsInWindow(today, YAHRZEIT_LOOKAHEAD_DAYS);

  const years = Array.from(new Set(pairs.map(p => p.year)));
  for (const year of years) {
    await anniversaryRepo.ensureHebrewHorizonForYear(siteId, year);
  }

  const due: DueReminder[] = [];
  const seenKeys = new Set<string>();

  for (const { month, year } of pairs) {
    const events = await anniversaryRepo.getEventsForMonth(siteId, month, year);
    for (const event of events) {
      const evaluation = isEventDue(event, year, today);
      if (!evaluation) continue;

      const key = `${event.id}_${evaluation.occurrenceYear}_${evaluation.topic}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      due.push({ event, topic: evaluation.topic, occurrenceYear: evaluation.occurrenceYear });
    }
  }

  return due;
}

async function processSite(siteId: string, today: Date, reminderRepo: ReminderRepository) {
  const memberRepo = new MemberRepository();
  const dueReminders = await computeDueReminders(siteId, today);

  const result = { siteId, due: dueReminders.length, sent: 0, skippedOptOut: 0, skippedAlreadySent: 0, skippedNoEmail: 0 };
  if (dueReminders.length === 0) {
    return result;
  }

  const members = (await memberRepo.listActiveMembers(siteId)).filter(m => !!m.email);

  for (const reminder of dueReminders) {
    const { event, topic, occurrenceYear } = reminder;
    for (const member of members) {
      if (await isOptedOut(member.id, siteId, topic)) {
        result.skippedOptOut++;
        continue;
      }

      const dedupId = reminderSendId(member.id, event.id, occurrenceYear, topic);
      if (await reminderRepo.hasSent(dedupId)) {
        result.skippedAlreadySent++;
        continue;
      }

      console.log('[cron/reminders] would send', {
        siteId,
        member: { id: member.id, email: member.email },
        topic,
        event: { id: event.id, name: event.name, type: event.type },
        occurrenceYear,
      });

      await sendTransactionalEmail({
        to: member.email,
        subject: topic === 'birth' ? `Upcoming birthday: ${event.name}` : `Yahrzeit reminder: ${event.name}`,
        html: `<p>${event.name}</p>`,
        lang: member.defaultLocale,
      });

      await reminderRepo.recordSent({
        id: dedupId,
        memberId: member.id,
        siteId,
        anniversaryEventId: event.id,
        topic,
        occurrenceYear,
      });

      result.sent++;
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const siteRepo = new SiteRepository();
    const reminderRepo = new ReminderRepository();
    const siteIds = await siteRepo.listAllSiteIds();
    const today = startOfDay(new Date());

    const results = [];
    for (const siteId of siteIds) {
      results.push(await processSite(siteId, today, reminderRepo));
    }

    return NextResponse.json({ ranAt: today.toISOString(), sites: results });
  } catch (error) {
    console.error('[cron/reminders] failed', error);
    return NextResponse.json({ error: 'Failed to compute reminders' }, { status: 500 });
  }
}
