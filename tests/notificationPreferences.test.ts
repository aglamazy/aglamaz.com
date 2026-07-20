import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { normalizePreferences } from '../src/repositories/NotificationPreferencesRepository.utils';

function testOldShapeDocReadsAsDocumentedDefaults() {
  const oldShapeDoc = { birthOptOut: true, deathOptOut: true };
  const prefs = normalizePreferences('member-1', 'site-1', oldShapeDoc);

  assert.equal(prefs.magazineEnabled, true, 'old-shape doc should default magazineEnabled to true');
  assert.equal(prefs.magazineCadence, 'monthly', 'old-shape doc should default magazineCadence to monthly');
  assert.equal(prefs.inDayRemindersEnabled, true, 'old-shape doc should default inDayRemindersEnabled to true');
  console.log('old-shape doc reads as documented defaults passed');
}

function testMissingDocReadsAsDocumentedDefaults() {
  const prefs = normalizePreferences('member-1', 'site-1', undefined);

  assert.equal(prefs.magazineEnabled, true);
  assert.equal(prefs.magazineCadence, 'monthly');
  assert.equal(prefs.inDayRemindersEnabled, true);
  console.log('missing doc reads as documented defaults passed');
}

function testNewShapeDocRoundTrips() {
  const updatedAt = Timestamp.now();
  const newShapeDoc = {
    magazineEnabled: false,
    magazineCadence: 'weekly',
    inDayRemindersEnabled: false,
    updatedAt,
  };
  const prefs = normalizePreferences('member-1', 'site-1', newShapeDoc);

  assert.equal(prefs.memberId, 'member-1');
  assert.equal(prefs.siteId, 'site-1');
  assert.equal(prefs.magazineEnabled, false);
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

testOldShapeDocReadsAsDocumentedDefaults();
testMissingDocReadsAsDocumentedDefaults();
testNewShapeDocRoundTrips();
testInvalidCadenceFallsBackToMonthly();
