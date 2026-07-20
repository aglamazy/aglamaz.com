import assert from 'node:assert/strict';
import { checkRateLimit, __resetRateLimitStore } from '../src/lib/rateLimit';

function testAllowsUpToLimitThenRejects() {
  __resetRateLimitStore();
  const opts = { limit: 3, windowMs: 60_000 };

  assert.equal(checkRateLimit('key1', opts).allowed, true);
  assert.equal(checkRateLimit('key1', opts).allowed, true);
  assert.equal(checkRateLimit('key1', opts).allowed, true);
  // 4th submission within the window from the same key must be rejected.
  const fourth = checkRateLimit('key1', opts);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.remaining, 0);

  console.log('rate limit rejects (N+1)th submission within window test passed');
}

function testDifferentKeysAreIndependent() {
  __resetRateLimitStore();
  const opts = { limit: 1, windowMs: 60_000 };

  assert.equal(checkRateLimit('a', opts).allowed, true);
  assert.equal(checkRateLimit('a', opts).allowed, false);
  // A different key (e.g. a different IP or page) is unaffected.
  assert.equal(checkRateLimit('b', opts).allowed, true);

  console.log('rate limit keys are independent test passed');
}

function run() {
  testAllowsUpToLimitThenRejects();
  testDifferentKeysAreIndependent();
}

run();
