import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { normalizePreferences } from '../src/repositories/NotificationPreferencesRepository.utils';

function testOldShapeDocReadsAsDocumentedDefaults() {
  const oldShapeDoc = { birthOptOut: true, deathOptOut: true };
  const prefs = normalizePreferences('member-1', 'site-1', oldShapeDoc);

  assert.equal(prefs.magazineCadence, 'monthly', 'old-shape doc should default magazineCadence to monthly');
  assert.equal(prefs.inDayRemindersEnabled, true, 'old-shape doc should default inDayRemindersEnabled to true');
  console.log('old-shape doc reads as documented defaults passed');
}

function testMissingDocReadsAsDocumentedDefaults() {
  const prefs = normalizePreferences('member-1', 'site-1', undefined);

  assert.equal(prefs.magazineCadence, 'monthly');
  assert.equal(prefs.inDayRemindersEnabled, true);
  console.log('missing doc reads as documented defaults passed');
}

function testNewShapeDocRoundTrips() {
  const updatedAt = Timestamp.now();
  const newShapeDoc = {
    magazineCadence: 'weekly',
    inDayRemindersEnabled: false,
    updatedAt,
  };
  const prefs = normalizePreferences('member-1', 'site-1', newShapeDoc);

  assert.equal(prefs.memberId, 'member-1');
  assert.equal(prefs.siteId, 'site-1');
  assert.equal(prefs.magazineCadence, 'weekly');
  assert.equal(prefs.inDayRemindersEnabled, false);
  assert.equal(prefs.updatedAt, updatedAt);
  console.log('new-shape doc round-trips passed');
}

function testNoneCadenceRoundTrips() {
  const prefs = normalizePreferences('member-1', 'site-1', { magazineCadence: 'none' });
  assert.equal(prefs.magazineCadence, 'none', 'none must round-trip, not fall back to monthly');
  console.log('none cadence round-trips passed');
}

function testInvalidCadenceFallsBackToMonthly() {
  const prefs = normalizePreferences('member-1', 'site-1', { magazineCadence: 'daily' });
  assert.equal(prefs.magazineCadence, 'monthly', 'invalid cadence value should fall back to monthly');
  console.log('invalid cadence falls back to monthly passed');
}

function testRetiredMagazineEnabledFalseReadsAsNone() {
  // Docs written by the earlier (corrected) famcircle#50 shape carried a separate
  // magazineEnabled boolean alongside magazineCadence. Per the spec §4 revision, a
  // false magazineEnabled must still be honored as an off-signal even though the
  // field itself is retired - it must not silently re-enable the magazine.
  const prefs = normalizePreferences('member-1', 'site-1', {
    magazineEnabled: false,
    magazineCadence: 'weekly',
  });
  assert.equal(prefs.magazineCadence, 'none', 'magazineEnabled=false must be read back as cadence none');
  console.log('retired magazineEnabled=false reads as none passed');
}

function testRetiredMagazineEnabledTrueDefersToCadence() {
  const prefs = normalizePreferences('member-1', 'site-1', {
    magazineEnabled: true,
    magazineCadence: 'weekly',
  });
  assert.equal(prefs.magazineCadence, 'weekly', 'magazineEnabled=true must defer to magazineCadence');
  console.log('retired magazineEnabled=true defers to cadence passed');
}

testOldShapeDocReadsAsDocumentedDefaults();
testMissingDocReadsAsDocumentedDefaults();
testNewShapeDocRoundTrips();
testNoneCadenceRoundTrips();
testInvalidCadenceFallsBackToMonthly();
testRetiredMagazineEnabledFalseReadsAsNone();
testRetiredMagazineEnabledTrueDefersToCadence();
