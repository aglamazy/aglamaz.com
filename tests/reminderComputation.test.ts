import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import {
  isEventDue,
  monthYearPairsInWindow,
  startOfDay,
  daysBetween,
  resolveOccurrenceDate,
} from '../src/services/ReminderComputationService';
import type { AnniversaryEvent } from '../src/entities/Anniversary';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function baseEvent(overrides: Partial<AnniversaryEvent>): AnniversaryEvent {
  return {
    id: 'evt1',
    siteId: 'site1',
    ownerId: 'owner1',
    name: 'Test Event',
    type: 'birthday',
    date: Timestamp.fromDate(new Date(1990, 5, 15)),
    month: 5,
    day: 15,
    year: 1990,
    isAnnual: true,
    createdAt: Timestamp.now(),
    ...overrides,
  } as AnniversaryEvent;
}

function testGregorianBirthdayWindow() {
  const today = startOfDay(new Date());

  // Exactly on the day - due.
  const onDay = addDays(today, 0);
  const dueToday = isEventDue(baseEvent({ month: onDay.getMonth(), day: onDay.getDate() }), onDay.getFullYear(), today);
  assert.ok(dueToday, 'birthday today should be due');
  assert.equal(dueToday!.topic, 'birth');

  // Exactly 7 days out - still within the digest window - due.
  const sevenOut = addDays(today, 7);
  const dueSeven = isEventDue(baseEvent({ month: sevenOut.getMonth(), day: sevenOut.getDate() }), sevenOut.getFullYear(), today);
  assert.ok(dueSeven, 'birthday 7 days out should be due');

  // 8 days out - outside the window - not due.
  const eightOut = addDays(today, 8);
  const notDueEight = isEventDue(baseEvent({ month: eightOut.getMonth(), day: eightOut.getDate() }), eightOut.getFullYear(), today);
  assert.equal(notDueEight, null, 'birthday 8 days out should not be due');

  // Yesterday - already passed - not due.
  const yesterday = addDays(today, -1);
  const notDueYesterday = isEventDue(baseEvent({ month: yesterday.getMonth(), day: yesterday.getDate() }), yesterday.getFullYear(), today);
  assert.equal(notDueYesterday, null, 'birthday that already passed should not be due');

  console.log('gregorian birthday window passed');
}

function testYahrzeitExactDay() {
  const today = startOfDay(new Date());

  const thirtyOut = addDays(today, 30);
  const due = isEventDue(
    baseEvent({ type: 'death', month: thirtyOut.getMonth(), day: thirtyOut.getDate() }),
    thirtyOut.getFullYear(),
    today
  );
  assert.ok(due, 'death event exactly 30 days out should be due');
  assert.equal(due!.topic, 'death');

  const twentyNineOut = addDays(today, 29);
  const notDue29 = isEventDue(
    baseEvent({ type: 'death', month: twentyNineOut.getMonth(), day: twentyNineOut.getDate() }),
    twentyNineOut.getFullYear(),
    today
  );
  assert.equal(notDue29, null, 'death event 29 days out should not be due (single-shot at day 30)');

  const thirtyOneOut = addDays(today, 31);
  const notDue31 = isEventDue(
    baseEvent({ type: 'death', month: thirtyOneOut.getMonth(), day: thirtyOneOut.getDate() }),
    thirtyOneOut.getFullYear(),
    today
  );
  assert.equal(notDue31, null, 'death event 31 days out should not be due');

  console.log('yahrzeit exact-day check passed');
}

function testHebrewEventUsesDateFieldNotMonthDay() {
  const today = startOfDay(new Date());
  const thirtyOut = addDays(today, 30);

  // useHebrew events have month/day/year overwritten to a DIFFERENT display occurrence
  // by getEventsForMonth in some paths - the due-check must trust `date`, not month/day.
  const event = baseEvent({
    type: 'death',
    useHebrew: true,
    month: 0,
    day: 1,
    date: Timestamp.fromDate(thirtyOut),
  });
  const due = isEventDue(event, thirtyOut.getFullYear(), today);
  assert.ok(due, 'hebrew event due-check must use event.date, not month/day');

  console.log('hebrew event uses date field passed');
}

function testAnnualEventIgnoresStaleStoredYear() {
  const today = startOfDay(new Date());
  const sevenOut = addDays(today, 7);

  // Annual Gregorian events keep their ORIGINAL creation year in `date`/`year` - the due
  // check must reconstruct the occurrence from month/day + the queried year, not the stale one.
  const event = baseEvent({
    month: sevenOut.getMonth(),
    day: sevenOut.getDate(),
    year: 1955,
    date: Timestamp.fromDate(new Date(1955, sevenOut.getMonth(), sevenOut.getDate())),
    isAnnual: true,
  });
  const due = isEventDue(event, sevenOut.getFullYear(), today);
  assert.ok(due, 'annual event due-check must use the queried year, not the stale stored year');
  assert.equal(due!.occurrenceYear, sevenOut.getFullYear());

  console.log('annual event ignores stale stored year passed');
}

function testNonAnnualEventOnlyDueInItsOwnYear() {
  const today = startOfDay(new Date());
  const sevenOut = addDays(today, 7);

  const event = baseEvent({
    month: sevenOut.getMonth(),
    day: sevenOut.getDate(),
    year: sevenOut.getFullYear(),
    date: Timestamp.fromDate(sevenOut),
    isAnnual: false,
  });
  const due = isEventDue(event, sevenOut.getFullYear(), today);
  assert.ok(due, 'one-time event due in its own year should be due');

  console.log('non-annual event own-year check passed');
}

function testIgnoresOtherTypes() {
  const today = startOfDay(new Date());
  const onDay = addDays(today, 0);
  for (const type of ['wedding', 'other'] as const) {
    const event = baseEvent({ type, month: onDay.getMonth(), day: onDay.getDate() });
    const due = isEventDue(event, onDay.getFullYear(), today);
    assert.equal(due, null, `${type} events should never be due`);
  }
  console.log('non-reminder types ignored passed');
}

function testMonthYearPairsSpanYearBoundary() {
  const today = new Date(2026, 11, 28); // Dec 28, 2026
  const pairs = monthYearPairsInWindow(today, 7);
  assert.deepEqual(pairs, [
    { month: 11, year: 2026 },
    { month: 0, year: 2027 },
  ]);
  console.log('month/year pairs span year boundary passed');
}

function testDaysBetweenIgnoresTimeOfDay() {
  const from = new Date(2026, 0, 1, 23, 59);
  const to = new Date(2026, 0, 2, 0, 1);
  assert.equal(daysBetween(from, to), 1);
  console.log('daysBetween ignores time-of-day passed');
}

function testResolveOccurrenceDateNonAnnualUsesStoredDate() {
  const stored = new Date(2026, 4, 10);
  const event = baseEvent({ isAnnual: false, date: Timestamp.fromDate(stored) });
  const resolved = resolveOccurrenceDate(event, 2026);
  assert.equal(resolved.getFullYear(), 2026);
  assert.equal(resolved.getMonth(), 4);
  assert.equal(resolved.getDate(), 10);
  console.log('resolveOccurrenceDate non-annual uses stored date passed');
}

testGregorianBirthdayWindow();
testYahrzeitExactDay();
testHebrewEventUsesDateFieldNotMonthDay();
testAnnualEventIgnoresStaleStoredYear();
testNonAnnualEventOnlyDueInItsOwnYear();
testIgnoresOtherTypes();
testMonthYearPairsSpanYearBoundary();
testDaysBetweenIgnoresTimeOfDay();
testResolveOccurrenceDateNonAnnualUsesStoredDate();
