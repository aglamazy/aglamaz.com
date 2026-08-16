import assert from 'node:assert/strict';
import http from 'node:http';
import { checkCronAuth, checkAllCronAuth, CRON_PROBES } from '../scripts/lib/cronAuthCheck';

function startServer(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'string' || address === null) throw new Error('unexpected server address');
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

// Simulates a deployment whose secret still matches - the healthy case.
async function testDetectsMatchingSecret() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ sent: 0, failed: 0 }));
  });

  try {
    const result = await checkCronAuth(url, 'the-current-secret');
    assert.equal(result.healthy, true);
    assert.equal(result.reachable, true);
    assert.equal(result.statusCode, 200);
  } finally {
    await close();
  }

  console.log('cron-auth-check detects a matching secret test passed');
}

// The exact famcircle#156 failure mode: the deployed function's own baked secret no
// longer matches what's passed (the current dashboard value) - a stale post-rotation
// mismatch, surfaced here as a 401.
async function testDetectsStaleSecretMismatch() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
  });

  try {
    const result = await checkCronAuth(url, 'the-current-secret');
    assert.equal(result.healthy, false, 'a 401 must be detected as unhealthy - this is the famcircle#156 failure mode');
    assert.equal(result.reachable, true, 'the server did respond, just rejected the auth');
    assert.equal(result.statusCode, 401);
  } finally {
    await close();
  }

  console.log('cron-auth-check detects a stale-secret mismatch (401) test passed');
}

async function testDetectsUnreachableDeployment() {
  const { url, close } = await startServer((req, res) => {
    res.destroy();
  });
  await close();

  const result = await checkCronAuth(url, 'the-current-secret', 2_000);
  assert.equal(result.reachable, false);
  assert.equal(result.healthy, false);
  assert.ok(result.error, 'expected a connection error message');

  console.log('cron-auth-check detects an unreachable deployment test passed');
}

// famcircle#161's test:deploy needs a route-SPECIFIC failure caught, not just the
// shared secret - e.g. a typo'd comparison on one route that the others don't have.
async function testDetectsARouteSpecificFailure() {
  const { url, close } = await startServer((req, res) => {
    if (req.url?.includes('/api/cron/blog-autogen')) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  try {
    const results = await checkAllCronAuth(url, 'the-current-secret');
    assert.equal(results.length, CRON_PROBES.length);
    const blogAutogen = results.find((r) => r.route === '/api/cron/blog-autogen');
    assert.ok(blogAutogen, 'blog-autogen must be one of the probed routes');
    assert.equal(blogAutogen!.healthy, false, 'the one broken route must be flagged');
    const others = results.filter((r) => r.route !== '/api/cron/blog-autogen');
    assert.ok(others.every((r) => r.healthy), 'the other 4 routes must not be flagged just because a sibling route broke');
  } finally {
    await close();
  }

  console.log('cron-auth-check (all-routes) isolates a single route-specific failure test passed');
}

async function testAllRoutesHealthyWhenSecretMatches() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  try {
    const results = await checkAllCronAuth(url, 'the-current-secret');
    assert.equal(results.length, 5, 'all 5 cron routes must be probed');
    assert.ok(results.every((r) => r.healthy && r.statusCode === 200));
  } finally {
    await close();
  }

  console.log('cron-auth-check (all-routes) reports healthy across all 5 routes test passed');
}

async function run() {
  await testDetectsMatchingSecret();
  await testDetectsStaleSecretMismatch();
  await testDetectsUnreachableDeployment();
  await testDetectsARouteSpecificFailure();
  await testAllRoutesHealthyWhenSecretMatches();
}

run();
