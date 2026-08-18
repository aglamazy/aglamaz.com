import assert from 'node:assert/strict';
import http from 'node:http';
import { checkEmailVolume } from '../scripts/lib/emailVolumeCheck';

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

// checkEmailVolume hardcodes the real Resend URL, so these tests monkeypatch global fetch
// to redirect to a local server instead - keeps the real Resend endpoint path exercised in
// scripts/check-email-volume.ts, while still testing against a real HTTP server per this
// repo's convention (see tests/uptimeCheck.test.ts).
const realFetch = global.fetch;

function mockFetchTo(url: string) {
  global.fetch = ((input: any, init?: any) => realFetch(url, init)) as typeof fetch;
}

async function testHealthyWhenRecentEmailsExist() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [{ created_at: new Date().toISOString() }] }));
  });
  mockFetchTo(url);

  try {
    const result = await checkEmailVolume('fake-key', 48);
    assert.equal(result.healthy, true);
    assert.equal(result.count, 1);
  } finally {
    global.fetch = realFetch;
    await close();
  }
  console.log('healthy when a recent email exists in the window passed');
}

async function testUnhealthyWhenNoEmailsInWindow() {
  const staleDate = new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(); // 100h ago
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [{ created_at: staleDate }] }));
  });
  mockFetchTo(url);

  try {
    const result = await checkEmailVolume('fake-key', 48);
    assert.equal(result.healthy, false, 'an email older than the window must not count');
    assert.equal(result.count, 0);
  } finally {
    global.fetch = realFetch;
    await close();
  }
  console.log('unhealthy when the only emails are outside the window passed');
}

async function testUnhealthyOnApiError() {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'invalid key' }));
  });
  mockFetchTo(url);

  try {
    const result = await checkEmailVolume('fake-key', 48);
    assert.equal(result.healthy, false);
    assert.ok(result.error);
  } finally {
    global.fetch = realFetch;
    await close();
  }
  console.log('unhealthy and surfaces the error on a Resend API failure passed');
}

async function run() {
  await testHealthyWhenRecentEmailsExist();
  await testUnhealthyWhenNoEmailsInWindow();
  await testUnhealthyOnApiError();
}

run();
