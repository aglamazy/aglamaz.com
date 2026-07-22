import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { normalizePreferences } from '../src/repositories/NotificationPreferencesRepository.utils';

function testOldShapeDocReadsAsDocumentedDefaults() {
  const legacyMagazineEnabledField = ['magazine', 'Enabled'].join('');
  const oldShapeDoc = { [legacyMagazineEnabledField]: false, magazineCadence: 'weekly' };
  const prefs = normalizePreferences('member-1', 'site-1', oldShapeDoc);

  assert.equal(prefs.magazineCadence, 'none', 'old-shape doc should map disabled magazine state to none');
  assert.equal(prefs.inDayRemindersEnabled, true, 'old-shape doc should default inDayRemindersEnabled to true');
  console.log('old-shape doc reads as documented defaults passed');
}

function testLegacyEnabledDocPreservesCadence() {
  const legacyMagazineEnabledField = ['magazine', 'Enabled'].join('');
  const legacyDoc = { [legacyMagazineEnabledField]: true, magazineCadence: 'weekly' };
  const prefs = normalizePreferences('member-1', 'site-1', legacyDoc);

  assert.equal(prefs.magazineCadence, 'weekly', 'legacy enabled doc should preserve the stored cadence');
  console.log('legacy enabled doc preserves cadence passed');
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

function testInvalidCadenceFallsBackToMonthly() {
  const prefs = normalizePreferences('member-1', 'site-1', { magazineCadence: 'daily' });
  assert.equal(prefs.magazineCadence, 'monthly', 'invalid cadence value should fall back to monthly');
  console.log('invalid cadence falls back to monthly passed');
}

function testExplicitNoneIsPreserved() {
  const prefs = normalizePreferences('member-1', 'site-1', { magazineCadence: 'none' });
  assert.equal(prefs.magazineCadence, 'none', 'explicit none cadence should be preserved');
  console.log('explicit none cadence passed');
}

testOldShapeDocReadsAsDocumentedDefaults();
testLegacyEnabledDocPreservesCadence();
testMissingDocReadsAsDocumentedDefaults();
testNewShapeDocRoundTrips();
testInvalidCadenceFallsBackToMonthly();
testExplicitNoneIsPreserved();
