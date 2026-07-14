import type { AnniversaryEvent } from '@/entities/Anniversary';
import type { ReminderTopic } from '@/repositories/ReminderRepository';

// Rolling lookahead: birthdays are "due" for the whole week before them (a digest window);
// yahrzeit is a single reminder fired the day it enters the ~30-day mark, per
// docs/notifications-reminders-spec.md's "Reminder computation" section.
export const BIRTHDAY_LOOKAHEAD_DAYS = 7;
export const YAHRZEIT_LOOKAHEAD_DAYS = 30;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/**
 * getEventsForMonth only rewrites month/day/year/date to the queried occurrence for Hebrew
 * events (see the AnniversaryRepository landmine) - for annual Gregorian events those fields
 * are the ORIGINAL creation date, not this occurrence, so the occurrence date must be
 * reconstructed from event.month/event.day + the year we queried for.
 */
export function resolveOccurrenceDate(event: AnniversaryEvent, queriedYear: number): Date {
  if (event.useHebrew || !event.isAnnual) {
    const raw = event.date;
    return raw?.toDate ? raw.toDate() : new Date(raw);
  }
  return new Date(queriedYear, event.month, event.day);
}

/** Unique (month, year) pairs covering [today, today + lookaheadDays] inclusive. */
export function monthYearPairsInWindow(today: Date, lookaheadDays: number): Array<{ month: number; year: number }> {
  const seen = new Set<string>();
  const pairs: Array<{ month: number; year: number }> = [];
  for (let offset = 0; offset <= lookaheadDays; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ month: d.getMonth(), year: d.getFullYear() });
    }
  }
  return pairs;
}

export interface DueEvaluation {
  topic: ReminderTopic;
  occurrenceYear: number;
}

/**
 * Pure per-event due-check: given an event as returned by getEventsForMonth for
 * `queriedYear`, decide whether it is due for a reminder today. No I/O.
 */
export function isEventDue(event: AnniversaryEvent, queriedYear: number, today: Date): DueEvaluation | null {
  let topic: ReminderTopic;
  let lookahead: number;
  if (event.type === 'birthday') {
    topic = 'birth';
    lookahead = BIRTHDAY_LOOKAHEAD_DAYS;
  } else if (event.type === 'death') {
    topic = 'death';
    lookahead = YAHRZEIT_LOOKAHEAD_DAYS;
  } else {
    return null;
  }

  const occurrenceDate = resolveOccurrenceDate(event, queriedYear);
  const daysUntil = daysBetween(today, occurrenceDate);

  const isDue = topic === 'birth'
    ? daysUntil >= 0 && daysUntil <= lookahead
    : daysUntil === lookahead;

  return isDue ? { topic, occurrenceYear: queriedYear } : null;
}
