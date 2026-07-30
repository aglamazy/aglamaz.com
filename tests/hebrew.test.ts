/**
 * Tests for formatHebrewDisplay's Hebrew-letter (gematria) conversion.
 *
 * Node's bundled ICU does not support the `hebr` numbering system for
 * Intl.DateTimeFormat/NumberFormat (verified empirically - silently falls back to
 * Western digits regardless of locale/extension requested), so day/year numerals are
 * composed manually - this is the regression guard for that conversion (Agla, 2026-07-21:
 * "Write real Hebrew date: ט"ז אלול תשע"ו").
 */

import assert from 'node:assert/strict';
import { formatHebrewDisplay, formatHebrewKey, findGregorianForHebrewKeyInYear, resolveHebrewOccurrenceForMonth } from '../src/utils/hebrew';

function testUsesRealHebrewLettersNotDigits() {
  const result = formatHebrewDisplay(new Date(2026, 7, 29));
  assert.ok(!/\d/.test(result), `must contain no Western digits, got: ${result}`);
  assert.ok(/[א-ת]/.test(result), `must contain real Hebrew letters, got: ${result}`);
  console.log('Hebrew date uses real letters, no digits: PASSED');
}

function testFifteenAndSixteenAvoidDivineNameForms() {
  // 15 and 16 are conventionally ט"ו / ט"ז, never יה / יו (which would resemble God's name).
  const fifteen = formatHebrewDisplay(new Date(2026, 5, 30)); // 15 Sivan 5786
  const sixteen = formatHebrewDisplay(new Date(2026, 7, 29)); // 16 Elul 5786
  assert.ok(fifteen.startsWith('ט"ו'), `15 must render as ט"ו, got: ${fifteen}`);
  assert.ok(sixteen.startsWith('ט"ז'), `16 must render as ט"ז, got: ${sixteen}`);
  console.log('15/16 avoid divine-name-resembling forms: PASSED');
}

function testSingleLetterGetsGeresh() {
  // A single-letter numeral gets a single geresh/quote (e.g. 4 -> ד'), a multi-letter
  // one gets it before the last letter (gershayim, e.g. 786 -> תשפ"ו).
  const result = formatHebrewDisplay(new Date(2026, 6, 18)); // 4 Av 5786
  assert.ok(result.startsWith("ד'"), `single-digit day must use a single geresh, got: ${result}`);
  assert.ok(result.includes('תשפ"ו'), `year 786 must render as תשפ"ו with gershayim before the last letter, got: ${result}`);
  console.log('geresh/gershayim punctuation placement: PASSED');
}

function testYearDropsThousandsDigit() {
  // Hebrew years are conventionally written without the leading thousands digit
  // (5786 -> תשפ"ו, not a form implying "5000+786").
  const result = formatHebrewDisplay(new Date(2026, 7, 29));
  assert.ok(!result.includes('ה׳') && !result.includes("ה'"), `must not spell out a thousands-digit prefix, got: ${result}`);
  console.log('year omits the thousands digit: PASSED');
}

function testResolveHebrewOccurrenceForMonthUsesOriginalForOccurrenceZero() {
  // The creation year is occurrence zero - passed through as-is, no Hebrew conversion.
  const ev = { month: 6, year: 1990, day: 30, hebrewKey: 'Av 8' };
  const occ = resolveHebrewOccurrenceForMonth(ev, 6, 1990);
  assert.deepEqual(occ, { month: 6, day: 30, year: 1990 });
  console.log('resolveHebrewOccurrenceForMonth passes through occurrence zero unchanged: PASSED');
}

function testResolveHebrewOccurrenceForMonthRecomputesFreshIgnoringStaleCache() {
  // Reproduces famcircle#120's 6-day-early birthday misfire: a Hebrew-tracked birthday
  // (birth year 1990, hebrewKey "Av 8") whose true 2026 occurrence is computed via the same
  // conversion function used at write time (ground truth). Simulate a STALE cached
  // hebrewOccurrences entry that's 6 days early - the kind of bad data a since-fixed
  // algorithm, a missed recompute-on-save, or hand-edited data could leave behind. The fix
  // must not even look at a cache like this: it recomputes straight from hebrewKey every
  // call, so a corrupted cache entry can no longer misfire the in-day cron.
  const birthKey = formatHebrewKey(new Date(1990, 6, 30));
  const trueOccurrence = findGregorianForHebrewKeyInYear(birthKey, 2026);
  assert.ok(trueOccurrence, 'sanity: a Hebrew key must resolve to a real Gregorian date');
  const trueMonth = trueOccurrence!.getMonth();
  const trueDay = trueOccurrence!.getDate();

  const staleWrongDay = trueDay - 6; // the misfire under test: 6 days early
  const evWithStaleCache: any = {
    month: 6,
    year: 1990,
    day: 30,
    hebrewKey: birthKey,
    // A stale/corrupted cache entry the old code trusted verbatim - the fixed resolver must
    // ignore this entirely, not merely prefer the fresh value when they happen to agree.
    hebrewOccurrences: [{ year: 2026, month: trueMonth, day: staleWrongDay, date: null }],
  };

  const occ = resolveHebrewOccurrenceForMonth(evWithStaleCache, trueMonth, 2026);
  assert.ok(occ, 'must resolve an occurrence for the queried month/year');
  assert.equal(occ!.day, trueDay, `must return the CORRECT day (${trueDay}), not the stale cached day (${staleWrongDay}) 6 days early`);
  assert.notEqual(occ!.day, staleWrongDay, 'must not reproduce the 6-day-early misfire');
  console.log('resolveHebrewOccurrenceForMonth recomputes fresh, ignoring a stale 6-day-early cache: PASSED');
}

function testResolveHebrewOccurrenceForMonthReturnsNullForNonMatchingMonth() {
  const birthKey = formatHebrewKey(new Date(1990, 6, 30));
  const trueOccurrence = findGregorianForHebrewKeyInYear(birthKey, 2026)!;
  const wrongMonth = (trueOccurrence.getMonth() + 1) % 12;
  const ev = { month: 6, year: 1990, day: 30, hebrewKey: birthKey };
  const occ = resolveHebrewOccurrenceForMonth(ev, wrongMonth, 2026);
  assert.equal(occ, null, 'must not report an occurrence for a month the event does not actually fall in');
  console.log('resolveHebrewOccurrenceForMonth returns null for a non-matching month: PASSED');
}

function run() {
  testUsesRealHebrewLettersNotDigits();
  testFifteenAndSixteenAvoidDivineNameForms();
  testSingleLetterGetsGeresh();
  testYearDropsThousandsDigit();
  testResolveHebrewOccurrenceForMonthUsesOriginalForOccurrenceZero();
  testResolveHebrewOccurrenceForMonthRecomputesFreshIgnoringStaleCache();
  testResolveHebrewOccurrenceForMonthReturnsNullForNonMatchingMonth();
}

run();
