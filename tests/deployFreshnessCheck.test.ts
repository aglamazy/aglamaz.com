import assert from 'node:assert/strict';
import { checkDeployFreshness } from '../scripts/lib/deployFreshnessCheck';

async function testHealthyWhenShasMatchExactly() {
  const result = await checkDeployFreshness('1305ad9cf967acf4b05cfb96539cbf1a5d905c3c', {
    fetchLiveProductionSha: async () => '1305ad9cf967acf4b05cfb96539cbf1a5d905c3c',
  });
  assert.equal(result.healthy, true);
  console.log('deploy-freshness healthy on exact match test passed');
}

async function testHealthyWhenComparingShortVsFullSha() {
  // Markette's "app served a 4-day-old build" shape - local git gives a short SHA,
  // Vercel's API gives the full 40-char one for the same commit.
  const result = await checkDeployFreshness('1305ad9', {
    fetchLiveProductionSha: async () => '1305ad9cf967acf4b05cfb96539cbf1a5d905c3c',
  });
  assert.equal(result.healthy, true, 'a short SHA must match its full-length counterpart');
  console.log('deploy-freshness healthy comparing short vs full SHA test passed');
}

async function testUnhealthyWhenStale() {
  const result = await checkDeployFreshness('e6d0cbd', {
    fetchLiveProductionSha: async () => '1305ad9cf967acf4b05cfb96539cbf1a5d905c3c',
  });
  assert.equal(result.healthy, false, 'a genuinely different commit must be flagged - the stale-build failure mode');
  assert.equal(result.liveSha, '1305ad9cf967acf4b05cfb96539cbf1a5d905c3c');
  console.log('deploy-freshness detects a stale/different live commit test passed');
}

async function testUnhealthyWhenNoDeploymentFound() {
  const result = await checkDeployFreshness('1305ad9', {
    fetchLiveProductionSha: async () => null,
  });
  assert.equal(result.healthy, false);
  assert.ok(result.error);
  console.log('deploy-freshness detects no production deployment found test passed');
}

async function run() {
  await testHealthyWhenShasMatchExactly();
  await testHealthyWhenComparingShortVsFullSha();
  await testUnhealthyWhenStale();
  await testUnhealthyWhenNoDeploymentFound();
}

run();
