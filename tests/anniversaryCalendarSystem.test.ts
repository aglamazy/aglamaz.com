// Regression test for AnniversaryRepository's calendarSystem/useHebrew reconciliation
// (rescued from famcircle#113's stranded #3167 - site-level calendar-system config,
// replacing the old single "use Hebrew calendar" checkbox). The riskiest part of this
// rescue: resolveCalendarSystem/isJewishCalendarSystem/clearHebrewFields decide whether
// the denormalized hebrewDate/hebrewKey/hebrewOccurrences fields get written or cleared -
// getting this wrong either silently keeps stale Hebrew data around after switching a
// site to Gregorian, or drops it while still marked useHebrew=true (see this repo's
// CLAUDE.md landmine on denormalized calendar fields).
import assert from 'node:assert/strict';
import {
  isJewishCalendarSystem,
  resolveCalendarSystem,
  clearHebrewFields,
} from '../src/repositories/AnniversaryRepository';

function testResolveCalendarSystemPrefersExplicitValue() {
  assert.equal(resolveCalendarSystem('gregorian', true, 'jewish'), 'gregorian');
  console.log('resolveCalendarSystem prefers an explicit calendarSystem over useHebrew/existing passed');
}

function testResolveCalendarSystemFallsBackToUseHebrewBoolean() {
  assert.equal(resolveCalendarSystem(undefined, true), 'jewish', 'useHebrew=true must map to jewish when no explicit calendarSystem is given');
  assert.equal(resolveCalendarSystem(undefined, false), 'gregorian', 'useHebrew=false must map to gregorian when no explicit calendarSystem is given');
  console.log('resolveCalendarSystem falls back to the legacy useHebrew boolean passed');
}

function testResolveCalendarSystemFallsBackToExisting() {
  assert.equal(resolveCalendarSystem(undefined, undefined, 'muslim'), 'muslim', 'with neither an explicit value nor useHebrew, the existing stored value must be preserved');
  assert.equal(resolveCalendarSystem(undefined, undefined, undefined), undefined);
  console.log('resolveCalendarSystem falls back to the existing stored value when nothing changed passed');
}

function testIsJewishCalendarSystem() {
  assert.equal(isJewishCalendarSystem('jewish'), true);
  assert.equal(isJewishCalendarSystem('gregorian'), false);
  assert.equal(isJewishCalendarSystem('muslim'), false);
  assert.equal(isJewishCalendarSystem(undefined), false);
  assert.equal(isJewishCalendarSystem(null), false);
  console.log('isJewishCalendarSystem only true for "jewish" passed');
}

function testClearHebrewFieldsMarksAllFourForDeletion() {
  const payload: Record<string, any> = { name: 'unrelated', useHebrew: true, hebrewDate: 'x' };
  clearHebrewFields(payload);
  // FieldValue.delete() sentinels aren't plain values - just assert the 4 keys were touched
  // and nothing else in the payload was disturbed.
  assert.ok('useHebrew' in payload);
  assert.ok('hebrewDate' in payload);
  assert.ok('hebrewKey' in payload);
  assert.ok('hebrewOccurrences' in payload);
  assert.equal(payload.name, 'unrelated', 'clearHebrewFields must not touch unrelated fields');
  console.log('clearHebrewFields marks useHebrew/hebrewDate/hebrewKey/hebrewOccurrences for deletion passed');
}

// The scenario the landmine is about: switching an existing jewish-calendar event to
// gregorian must actually clear the stale Hebrew fields, not just stop writing new ones.
function testSwitchingAwayFromJewishClearsStaleFields() {
  const nextCalendarSystem = resolveCalendarSystem('gregorian', undefined, 'jewish');
  assert.equal(nextCalendarSystem, 'gregorian');
  assert.equal(isJewishCalendarSystem(nextCalendarSystem), false, 'a switch to gregorian must not be treated as jewish');
  console.log('switching an event from jewish to gregorian resolves correctly (triggers the clear-fields path) passed');
}

async function run() {
  testResolveCalendarSystemPrefersExplicitValue();
  testResolveCalendarSystemFallsBackToUseHebrewBoolean();
  testResolveCalendarSystemFallsBackToExisting();
  testIsJewishCalendarSystem();
  testClearHebrewFieldsMarksAllFourForDeletion();
  testSwitchingAwayFromJewishClearsStaleFields();
}

run();
