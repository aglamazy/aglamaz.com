// Pure logic for the in-day reminder cron (docs/family-digest-formats-spec.md §2).
// Kept free of Firestore/network I/O so it can be unit-tested directly, mirroring
// the ReminderComputationService pattern used by the lead-time cron.

import type { AnniversaryEvent, AnniversaryType } from '@/entities/Anniversary';
import { ResendService } from '@/services/ResendService';

const IN_DAY_EVENT_TYPES: readonly AnniversaryType[] = ['birthday', 'death', 'wedding'];

/**
 * Events for the queried month/year whose (already display-resolved) day matches today.
 * Trusts ev.month/day/year as returned by AnniversaryRepository.getEventsForMonth, which
 * for Hebrew-tracked events are already overwritten to the occurrence being shown for the
 * queried month (see AnniversaryEvent's originalDate/... doc comment) - exactly the
 * "today" occurrence we want, not the event's original creation date.
 */
export function filterTodaysOccurrences(events: AnniversaryEvent[], today: Date): AnniversaryEvent[] {
  return events.filter((ev) => {
    if (!IN_DAY_EVENT_TYPES.includes(ev.type)) return false;
    if (ev.day !== today.getDate()) return false;
    return ev.isAnnual || ev.year === today.getFullYear();
  });
}

/**
 * Years since the wedding, for "N years of marriage" in-day copy. Must use originalYear over
 * year - for Hebrew-tracked events, getEventsForMonth overwrites year to the display occurrence
 * being shown, not the year the couple actually married (see AnniversaryEvent's doc comment).
 */
function computeYearsMarried(event: AnniversaryEvent, today: Date): number | undefined {
  const marriageYear = event.originalYear ?? event.year;
  if (typeof marriageYear !== 'number') return undefined;
  const years = today.getFullYear() - marriageYear;
  return years > 0 ? years : undefined;
}

export interface InDayCandidateMember {
  memberId: string;
  email?: string | null;
  inDayRemindersEnabled: boolean;
  defaultLocale?: string;
  firstName?: string;
  displayName?: string;
}

export interface InDayEmailPlan {
  memberId: string;
  to: string;
  subject: string;
  html: string;
  lang: string;
}

export function planInDaySends(params: {
  events: AnniversaryEvent[];
  today: Date;
  members: InDayCandidateMember[];
  siteName: string;
  calendarUrl: string;
  manageLinkFor: (memberId: string) => string;
}): InDayEmailPlan[] {
  const { events, today, members, siteName, calendarUrl, manageLinkFor } = params;
  const todaysEvents = filterTodaysOccurrences(events, today);
  if (todaysEvents.length === 0) return [];

  const plans: InDayEmailPlan[] = [];
  for (const member of members) {
    if (!member.email) continue;
    if (!member.inDayRemindersEnabled) continue;

    const lang = member.defaultLocale ?? 'he';
    const dir = lang === 'he' ? 'rtl' : 'ltr';
    const { subject, html } = ResendService.buildInDayReminderEmailHtml({
      firstName: member.firstName || member.displayName || member.email,
      events: todaysEvents.map((ev) => ({
        eventId: ev.id,
        type: ev.type,
        eventName: ev.name,
        imageUrl: ev.imageUrl,
        yearsMarried: ev.type === 'wedding' ? computeYearsMarried(ev, today) : undefined,
      })),
      calendarUrl,
      manageLink: manageLinkFor(member.memberId),
      lang,
      dir,
      siteName,
    });

    plans.push({ memberId: member.memberId, to: member.email, subject, html, lang });
  }

  return plans;
}
