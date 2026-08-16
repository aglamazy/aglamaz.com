import assert from 'node:assert/strict';
import { checkEnvCompleteness, EXPECTED_PROD_ENV_VARS } from '../scripts/lib/envCompletenessCheck';

async function testHealthyWhenEverythingIsSet() {
  const allNames = new Set(EXPECTED_PROD_ENV_VARS.map((v) => v.name));
  const result = await checkEnvCompleteness(EXPECTED_PROD_ENV_VARS, {
    listSetProductionEnvKeys: async () => allNames,
  });
  assert.equal(result.healthy, true);
  assert.deepEqual(result.missing, []);
  console.log('env-completeness healthy when everything is set test passed');
}

// The exact motivating case from spec-periodic-tests.md - AGENTS_OBSERVE_* confirmed
// unset 2026-08-16, a real gap that doesn't crash anything (the lib no-ops silently)
// but should still be caught.
async function testDetectsTheAgentsObserveGap() {
  const setKeys = new Set(EXPECTED_PROD_ENV_VARS.map((v) => v.name).filter((n) => !n.startsWith('AGENTS_OBSERVE_')));
  const result = await checkEnvCompleteness(EXPECTED_PROD_ENV_VARS, {
    listSetProductionEnvKeys: async () => setKeys,
  });
  assert.equal(result.healthy, false);
  assert.equal(result.missing.length, 3);
  assert.ok(result.missing.every((v) => v.name.startsWith('AGENTS_OBSERVE_')));
  console.log('env-completeness detects the real AGENTS_OBSERVE_* gap test passed');
}

async function testDetectsASingleMissingVar() {
  const setKeys = new Set(EXPECTED_PROD_ENV_VARS.map((v) => v.name).filter((n) => n !== 'CRON_SECRET'));
  const result = await checkEnvCompleteness(EXPECTED_PROD_ENV_VARS, {
    listSetProductionEnvKeys: async () => setKeys,
  });
  assert.equal(result.healthy, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].name, 'CRON_SECRET');
  console.log('env-completeness detects a single missing critical var test passed');
}

async function run() {
  await testHealthyWhenEverythingIsSet();
  await testDetectsTheAgentsObserveGap();
  await testDetectsASingleMissingVar();
}

run();
