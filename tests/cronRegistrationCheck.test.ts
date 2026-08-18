import assert from 'node:assert/strict';
import { checkCronRegistration, type ExpectedCronEntry } from '../scripts/lib/cronRegistrationCheck';

const EXPECTED: ExpectedCronEntry[] = [
  { path: '/api/cron/digest', schedule: '0,10,20,30,40,50 6 * * 5' },
  { path: '/api/cron/digest', schedule: '0 7 * * 5' },
  { path: '/api/cron/yahrzeit-whatsapp', schedule: '5 6 * * *' },
];

async function testHealthyWhenEveryEntryIsRegistered() {
  const result = await checkCronRegistration(EXPECTED, {
    fetchRegisteredCrons: async () => EXPECTED.map((e) => ({ ...e })),
  });
  assert.equal(result.healthy, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.scheduleMismatches, []);
  console.log('cron-registration healthy when every entry is registered test passed');
}

// The exact famcircle#156-adjacent gap this check exists for: a route that STILL
// responds correctly to a manual call (checkAllCronAuth would say healthy) but Vercel
// has genuinely stopped triggering it at all - a silently-dropped registration.
async function testDetectsAFullyMissingCronEntry() {
  const registered = EXPECTED.filter((e) => e.path !== '/api/cron/yahrzeit-whatsapp');
  const result = await checkCronRegistration(EXPECTED, {
    fetchRegisteredCrons: async () => registered,
  });
  assert.equal(result.healthy, false, 'a silently-removed cron entry must be caught - this is the control-proof-principle gap');
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].path, '/api/cron/yahrzeit-whatsapp');
  console.log('cron-registration detects a fully missing cron entry test passed');
}

// A schedule that drifted (someone edited vercel.json's cron time but the change never
// deployed, or vice versa) is a different failure from "gone entirely" - both real, both
// worth distinguishing in the report.
async function testDetectsAScheduleMismatch() {
  const registered = EXPECTED.map((e) =>
    e.path === '/api/cron/yahrzeit-whatsapp' ? { ...e, schedule: '5 8 * * *' } : e,
  );
  const result = await checkCronRegistration(EXPECTED, {
    fetchRegisteredCrons: async () => registered,
  });
  assert.equal(result.healthy, false);
  assert.equal(result.scheduleMismatches.length, 1);
  assert.equal(result.scheduleMismatches[0].expected, '5 6 * * *');
  assert.equal(result.scheduleMismatches[0].registered, '5 8 * * *');
  console.log('cron-registration detects a schedule drift (registered but wrong time) test passed');
}

async function run() {
  await testHealthyWhenEveryEntryIsRegistered();
  await testDetectsAFullyMissingCronEntry();
  await testDetectsAScheduleMismatch();
}

run();
