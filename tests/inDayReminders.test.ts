import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { filterTodaysOccurrences, planInDaySends } from '../src/services/InDayReminderService';
import type { AnniversaryEvent } from '../src/entities/Anniversary';

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function eventOn(overrides: Partial<AnniversaryEvent> & { day: number; month: number }): AnniversaryEvent {
  return {
    id: 'evt1',
    siteId: 'site1',
    ownerId: 'owner1',
    name: 'Test Event',
    type: 'birthday',
    date: Timestamp.fromDate(new Date(1990, overrides.month, overrides.day)),
    year: 1990,
    isAnnual: true,
    createdAt: Timestamp.now(),
    ...overrides,
  } as AnniversaryEvent;
}

function testFilterTodaysOccurrencesMatchesByDay() {
  const t = today();
  const onDay = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'birthday' });
  const otherDay = eventOn({ id: 'evt2', day: t.getDate() === 1 ? 2 : 1, month: t.getMonth(), type: 'birthday' });

  const result = filterTodaysOccurrences([onDay, otherDay], t);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'evt1');
  console.log('filterTodaysOccurrences matches only today passed');
}

function testFilterTodaysOccurrencesCoversAllThreeTypes() {
  const t = today();
  for (const type of ['birthday', 'death', 'wedding'] as const) {
    const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type });
    assert.equal(filterTodaysOccurrences([ev], t).length, 1, `${type} should count as an in-day occurrence`);
  }
  console.log('filterTodaysOccurrences covers birthday/death/wedding passed');
}

function testFilterTodaysOccurrencesIgnoresOtherType() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'other' });
  assert.equal(filterTodaysOccurrences([ev], t).length, 0);
  console.log('filterTodaysOccurrences ignores type=other passed');
}

function testFilterTodaysOccurrencesRespectsNonAnnualYear() {
  const t = today();
  const wrongYear = eventOn({ day: t.getDate(), month: t.getMonth(), isAnnual: false, year: t.getFullYear() - 1 });
  const rightYear = eventOn({ id: 'evt2', day: t.getDate(), month: t.getMonth(), isAnnual: false, year: t.getFullYear() });
  assert.equal(filterTodaysOccurrences([wrongYear], t).length, 0);
  assert.equal(filterTodaysOccurrences([rightYear], t).length, 1);
  console.log('filterTodaysOccurrences respects non-annual stored year passed');
}

const baseParams = (events: AnniversaryEvent[]) => ({
  events,
  today: today(),
  siteName: 'Test Family',
  calendarUrlFor: () => 'https://example.com/app/calendar',
  manageLinkFor: (memberId: string) => `https://example.com/manage?m=${memberId}`,
});

function testMemberWithOccurrenceGetsExactlyOneEmail() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'birthday' });

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 1, 'member with an occurrence today should get exactly one email');
  assert.equal(plans[0].memberId, 'm1');
  assert.equal(plans[0].to, 'm1@example.com');
  console.log('member with occurrence gets exactly one email passed');
}

function testMemberWithNoOccurrenceGetsZeroEmails() {
  const t = today();
  const otherDay = eventOn({ day: t.getDate() === 1 ? 2 : 1, month: t.getMonth(), type: 'birthday' });

  const plans = planInDaySends({
    ...baseParams([otherDay]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 0, 'member with no occurrence today should get zero emails');
  console.log('member with no occurrence gets zero emails passed');
}

function testMemberWithTogglOffGetsZeroEmailsRegardless() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'birthday' });

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: false, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 0, 'inDayRemindersEnabled=false should get zero emails regardless of occurrences');
  console.log('inDayRemindersEnabled=false gets zero emails passed');
}

function testMultipleOccurrencesSameDayStillOneEmail() {
  const t = today();
  const ev1 = eventOn({ id: 'evt1', day: t.getDate(), month: t.getMonth(), type: 'birthday', name: 'Alice' });
  const ev2 = eventOn({ id: 'evt2', day: t.getDate(), month: t.getMonth(), type: 'death', name: 'Bob' });

  const plans = planInDaySends({
    ...baseParams([ev1, ev2]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 1, 'two occurrences for the same member/day should still be a single email');
  assert.ok(plans[0].html.includes('Alice') && plans[0].html.includes('Bob'), 'the single email should mention both occurrences');
  console.log('multiple occurrences same day still one email passed');
}

function testMemberWithoutEmailIsSkipped() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'birthday' });

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [{ memberId: 'm1', email: null, inDayRemindersEnabled: true, defaultLocale: 'en' }],
  });

  assert.equal(plans.length, 0, 'member without an email address should be skipped');
  console.log('member without email is skipped passed');
}

// Matches only the clickable event row's anchor (style="display:flex...") - distinct from
// the email's generic "Open Calendar" CTA button, which always points at calendarUrl.
function extractRowHref(html: string): string | undefined {
  const match = html.match(/<a href="([^"]*)" style="display:flex/);
  return match?.[1];
}

function testDeathEventWithPublicMemorialUsesMemorialLink() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'death', name: 'Grandma' });

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
    memorialUrlByEventId: { evt1: 'https://example.com/public/memorial/abc123' },
  });

  assert.equal(plans.length, 1);
  assert.equal(
    extractRowHref(plans[0].html),
    'https://example.com/public/memorial/abc123',
    'row should link to the public memorial page, not the generic calendar',
  );
  console.log('death event with public memorial uses memorial link passed');
}

function testDeathEventWithoutMemorialUsesCalendarLink() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'death', name: 'Grandma' });

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
    // No memorialUrlByEventId entry - mirrors no blessing page, or a non-public one.
  });

  assert.equal(plans.length, 1);
  assert.equal(
    extractRowHref(plans[0].html),
    'https://example.com/app/calendar',
    'row should fall back to the generic calendar link when there is no public memorial page',
  );
  console.log('death event without public memorial uses calendar link passed');
}

function testHonoreeIsExcludedFromTheirOwnBirthdayNotice() {
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'birthday', honoreeMemberId: 'shaked' } as any);

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [
      { memberId: 'shaked', email: 'shaked@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
      { memberId: 'other', email: 'other@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 1, 'only the non-honoree member should receive a plan');
  assert.equal(plans[0].memberId, 'other', 'the honoree must not receive their own birthday notice');
  console.log('honoree excluded from their own birthday notice passed');
}

function testHonoreeWithoutHonoreeMemberIdStillGetsNotified() {
  // honoreeMemberId is optional - events without it (relative not on the site, or an older
  // event predating the field) must not accidentally exclude anyone.
  const t = today();
  const ev = eventOn({ day: t.getDate(), month: t.getMonth(), type: 'birthday' });

  const plans = planInDaySends({
    ...baseParams([ev]),
    members: [
      { memberId: 'm1', email: 'm1@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 1, 'members should still get notified when the event has no honoreeMemberId set');
  console.log('event without honoreeMemberId still notifies members passed');
}

function testHonoreeOfOneEventStillGetsNotifiedAboutAnother() {
  const t = today();
  const ownBirthday = eventOn({ id: 'evt1', day: t.getDate(), month: t.getMonth(), type: 'birthday', name: 'Shaked', honoreeMemberId: 'shaked' } as any);
  const grandmaYahrzeit = eventOn({ id: 'evt2', day: t.getDate(), month: t.getMonth(), type: 'death', name: 'Grandma' });

  const plans = planInDaySends({
    ...baseParams([ownBirthday, grandmaYahrzeit]),
    members: [
      { memberId: 'shaked', email: 'shaked@example.com', inDayRemindersEnabled: true, defaultLocale: 'en' },
    ],
  });

  assert.equal(plans.length, 1, 'the honoree should still get a notice about the OTHER today-event');
  assert.ok(!plans[0].html.includes('Shaked'), 'the honoree\'s own event must not appear in their email');
  assert.ok(plans[0].html.includes('Grandma'), 'the other today-event must still appear');
  console.log('honoree of one event still notified about a different today-event passed');
}

testFilterTodaysOccurrencesMatchesByDay();
testFilterTodaysOccurrencesCoversAllThreeTypes();
testFilterTodaysOccurrencesIgnoresOtherType();
testFilterTodaysOccurrencesRespectsNonAnnualYear();
testMemberWithOccurrenceGetsExactlyOneEmail();
testMemberWithNoOccurrenceGetsZeroEmails();
testMemberWithTogglOffGetsZeroEmailsRegardless();
testMultipleOccurrencesSameDayStillOneEmail();
testMemberWithoutEmailIsSkipped();
testDeathEventWithPublicMemorialUsesMemorialLink();
testDeathEventWithoutMemorialUsesCalendarLink();
testHonoreeIsExcludedFromTheirOwnBirthdayNotice();
testHonoreeWithoutHonoreeMemberIdStillGetsNotified();
testHonoreeOfOneEventStillGetsNotifiedAboutAnother();
