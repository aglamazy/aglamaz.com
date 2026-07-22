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
import { formatHebrewDisplay } from '../src/utils/hebrew';

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

function run() {
  testUsesRealHebrewLettersNotDigits();
  testFifteenAndSixteenAvoidDivineNameForms();
  testSingleLetterGetsGeresh();
  testYearDropsThousandsDigit();
}

run();
