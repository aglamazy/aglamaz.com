import assert from 'node:assert/strict';
import {
  groupMembersByCadenceAndLocale,
  resolveWeeklyDigestWindow,
  getPreviousMonth,
} from '../src/services/DigestSendService';

function testGroupsOnlyMatchingCadenceWithEmail() {
  const members = [
    { memberId: 'm1', email: 'a@x.com', magazineCadence: 'weekly' as const, defaultLocale: 'en' },
    { memberId: 'm2', email: 'b@x.com', magazineCadence: 'monthly' as const, defaultLocale: 'en' },
    { memberId: 'm3', email: null, magazineCadence: 'weekly' as const, defaultLocale: 'en' },
    { memberId: 'm4', email: 'd@x.com', magazineCadence: 'none' as const, defaultLocale: 'en' },
    { memberId: 'm5', email: 'e@x.com', magazineCadence: 'weekly' as const, defaultLocale: 'he' },
  ];

  const weeklyGroups = groupMembersByCadenceAndLocale(members, 'weekly');
  assert.deepEqual([...weeklyGroups.keys()].sort(), ['en', 'he']);
  assert.deepEqual(weeklyGroups.get('en')!.map((m) => m.memberId), ['m1']);
  assert.deepEqual(weeklyGroups.get('he')!.map((m) => m.memberId), ['m5']);

  const monthlyGroups = groupMembersByCadenceAndLocale(members, 'monthly');
  assert.deepEqual(monthlyGroups.get('en')!.map((m) => m.memberId), ['m2']);

  console.log('groups only matching cadence + has-email members: PASSED');
}

function testMissingLocaleDefaultsToHebrew() {
  const members = [
    { memberId: 'm1', email: 'a@x.com', magazineCadence: 'weekly' as const },
  ];
  const groups = groupMembersByCadenceAndLocale(members, 'weekly');
  assert.deepEqual([...groups.keys()], ['he']);
  console.log('missing defaultLocale groups under "he": PASSED');
}

function testWeeklyWindowSpansRollingMonthForward() {
  const reference = new Date(2026, 6, 20, 15, 30); // Jul 20 2026, mid-afternoon
  const { startDate, endDate } = resolveWeeklyDigestWindow(reference);

  assert.equal(startDate.getFullYear(), 2026);
  assert.equal(startDate.getMonth(), 6);
  assert.equal(startDate.getDate(), 20);
  assert.equal(startDate.getHours(), 0, 'window start must be normalized to start-of-day');

  assert.equal(endDate.getFullYear(), 2026);
  assert.equal(endDate.getMonth(), 7);
  assert.equal(endDate.getDate(), 20);

  const spanDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  assert.ok(spanDays >= 27 && spanDays <= 31, `window must span ~1 month, got ${spanDays} days`);
  assert.notEqual(startDate.getMonth(), endDate.getMonth(), 'a rolling window (not a fixed calendar month) crosses a month boundary here');

  console.log('weekly window spans ~1 week-to-1-month forward, not a fixed calendar month: PASSED');
}

function testPreviousMonthUnchangedForMonthlyCadence() {
  const reference = new Date(Date.UTC(2026, 6, 20));
  const { month, year } = getPreviousMonth(reference);
  assert.equal(month, 5);
  assert.equal(year, 2026);
  console.log('monthly cadence still resolves the previous calendar month: PASSED');
}

function run() {
  testGroupsOnlyMatchingCadenceWithEmail();
  testMissingLocaleDefaultsToHebrew();
  testWeeklyWindowSpansRollingMonthForward();
  testPreviousMonthUnchangedForMonthlyCadence();
}

run();
