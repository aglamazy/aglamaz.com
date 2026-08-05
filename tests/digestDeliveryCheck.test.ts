import assert from 'node:assert/strict';
import { checkDigestDelivery, type DigestDeliveryCheckDeps } from '../scripts/lib/digestDeliveryCheck';

// Fixed reference instant (a Monday, clear of any fire-window edge case) so these tests
// don't depend on the real current date - matches this repo's convention of testing pure
// logic against controlled inputs rather than wall-clock time.
const NOW = new Date('2026-08-10T12:00:00Z');

function makeDeps(overrides: Partial<DigestDeliveryCheckDeps> = {}): DigestDeliveryCheckDeps {
  return {
    listDigestEnabledSiteIds: async () => ['site-a'],
    countEligible: async () => 0,
    countUnsent: async () => 0,
    ...overrides,
  };
}

async function testHealthyWhenNoCadenceIsDueYet() {
  // Huge grace window -> neither weekly nor monthly's last fire is "due" for checking yet.
  const deps = makeDeps({
    countEligible: async () => {
      throw new Error('should not be called - nothing due');
    },
  });
  const result = await checkDigestDelivery(NOW, deps, 999999);
  assert.equal(result.healthy, true);
  assert.deepEqual(result.checkedCadences, []);
  assert.deepEqual(result.missing, []);
  console.log('healthy when no cadence has cleared its grace window passed');
}

async function testUnhealthyWhenEligibleRecipientsAllUnsent() {
  const deps = makeDeps({
    countEligible: async () => 3,
    countUnsent: async () => 3, // nobody got through
  });
  const result = await checkDigestDelivery(NOW, deps, 0);
  assert.equal(result.healthy, false);
  assert.equal(result.missing.length, 2, 'both weekly and monthly periods should be flagged for site-a');
  assert.ok(result.missing.every((m) => m.siteId === 'site-a' && m.eligibleCount === 3));
  console.log('unhealthy when a due period had eligible recipients and zero sends passed');
}

async function testHealthyWhenAtLeastOneRecipientWasSent() {
  const deps = makeDeps({
    countEligible: async () => 3,
    countUnsent: async () => 1, // 2 of 3 got through this period
  });
  const result = await checkDigestDelivery(NOW, deps, 0);
  assert.equal(result.healthy, true);
  assert.deepEqual(result.missing, []);
  console.log('healthy when at least one eligible recipient was sent this period passed');
}

async function testHealthyWhenNobodyEligible() {
  const deps = makeDeps({
    countEligible: async () => 0,
    countUnsent: async () => {
      throw new Error('should not be called - zero eligible skips the unsent check');
    },
  });
  const result = await checkDigestDelivery(NOW, deps, 0);
  assert.equal(result.healthy, true);
  assert.deepEqual(result.missing, []);
  console.log('healthy when no member is eligible for the cadence this period passed');
}

async function testErrorsSurfaceWithoutCrashingTheRun() {
  const deps = makeDeps({
    listDigestEnabledSiteIds: async () => ['site-a', 'site-b'],
    countEligible: async (siteId) => {
      if (siteId === 'site-a') throw new Error('boom');
      return 2;
    },
    countUnsent: async () => 0, // site-b: everyone sent
  });
  const result = await checkDigestDelivery(NOW, deps, 0);
  assert.equal(result.healthy, false);
  assert.equal(result.errors.length, 2, 'site-a errors once per due cadence (weekly + monthly)');
  assert.ok(result.errors.every((e) => e.siteId === 'site-a' && e.error === 'boom'));
  assert.deepEqual(result.missing, [], 'site-b delivered fine and should not be flagged');
  console.log('a single site error surfaces without crashing the rest of the run passed');
}

async function run() {
  await testHealthyWhenNoCadenceIsDueYet();
  await testUnhealthyWhenEligibleRecipientsAllUnsent();
  await testHealthyWhenAtLeastOneRecipientWasSent();
  await testHealthyWhenNobodyEligible();
  await testErrorsSurfaceWithoutCrashingTheRun();
}

run();
