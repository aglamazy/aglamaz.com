import assert from 'node:assert/strict';
import http from 'node:http';
import { checkHealth } from '../scripts/lib/uptimeCheck';

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

async function testDetectsHealthyDeployment() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ overall: { healthy: true, allHealthy: true } }));
  });

  try {
    const result = await checkHealth(url);
    assert.equal(result.healthy, true);
    assert.equal(result.reachable, true);
    assert.equal(result.statusCode, 200);
  } finally {
    await close();
  }

  console.log('uptime-check detects a healthy deployment test passed');
}

// Simulates the real failure mode the health endpoint reports when a
// critical service (e.g. Firebase) is down: HTTP 503 + overall.healthy=false.
async function testDetectsSimulatedServiceOutage() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      firebase: { healthy: false, status: 'Missing environment variables: FIREBASE_PROJECT_ID' },
      gmail: { healthy: true, status: 'OK' },
      translation: { healthy: true, status: 'OK' },
      overall: { healthy: false, allHealthy: false },
    }));
  });

  try {
    const result = await checkHealth(url);
    assert.equal(result.healthy, false, 'a 503 outage must be detected as unhealthy');
    assert.equal(result.reachable, true, 'the server did respond, just unhealthily');
    assert.equal(result.statusCode, 503);
  } finally {
    await close();
  }

  console.log('uptime-check detects a simulated service outage test passed');
}

// Simulates the deployment being entirely unreachable (site down, DNS/SSL
// failure, Vercel outage) rather than just an unhealthy service.
async function testDetectsUnreachableDeployment() {
  const { url, close } = await startServer((req, res) => {
    res.destroy();
  });
  // Close immediately so the port is not listening at all — the closest
  // simulation of "site down" a local test can produce deterministically.
  await close();

  const result = await checkHealth(url, 2_000);
  assert.equal(result.reachable, false);
  assert.equal(result.healthy, false);
  assert.ok(result.error, 'expected a connection error message');

  console.log('uptime-check detects an unreachable deployment test passed');
}

async function testDetectsMalformedResponse() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>not json</html>');
  });

  try {
    const result = await checkHealth(url);
    assert.equal(result.healthy, false);
    assert.equal(result.reachable, true);
    assert.ok(result.error);
  } finally {
    await close();
  }

  console.log('uptime-check detects a malformed response test passed');
}

async function run() {
  await testDetectsHealthyDeployment();
  await testDetectsSimulatedServiceOutage();
  await testDetectsUnreachableDeployment();
  await testDetectsMalformedResponse();
}

run();
