import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { NextRequest } from 'next/server.js';

import { ACCESS_TOKEN } from '../src/auth/cookies';
import { signAccessToken } from '../src/auth/service';
import { landingPage } from '../src/app/settings';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const claims = {
  userId: 'user1',
  siteId: 'site1',
  role: 'member',
  firstName: 'Test',
  lastName: 'User',
};

async function testValidTokenRedirect(path: string) {
  const token = signAccessToken(claims);
  const req = new NextRequest(`https://example.com${path}`, {
    headers: { cookie: `${ACCESS_TOKEN}=${token}` },
  });
  const { middleware } = await import('../src/middleware');
  const res = await middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'https://example.com/app');
  console.log(`valid token redirect (${path}) test passed`);
}

async function testExpiredTokenPageRewrite() {
  const expired = signAccessToken(claims, -1);
  const req = new NextRequest('https://example.com/protected', {
    headers: { cookie: `${ACCESS_TOKEN}=${expired}` }
  });
  const { middleware } = await import('../src/middleware');
  const res = await middleware(req);
  assert.equal(res.headers.get('x-middleware-rewrite'), 'https://example.com/auth-gate');
  console.log('expired token page rewrite test passed');
}

async function testLandingPageExpiredTokenRefresh() {
  const expired = signAccessToken(claims, -1);
  const req = new NextRequest(`https://example.com${landingPage}`, {
    headers: { cookie: `${ACCESS_TOKEN}=${expired}` }
  });
  const { middleware } = await import('../src/middleware');
  const res = await middleware(req);
  assert.equal(res.headers.get('x-middleware-rewrite'), 'https://example.com/auth-gate');
  console.log('landing page expired token refresh test passed');
}

async function testExpiredTokenApiUnauthorized() {
  const expired = signAccessToken(claims, -1);
  const req = new NextRequest('https://example.com/api/data', {
    headers: { cookie: `${ACCESS_TOKEN}=${expired}` }
  });
  const { middleware } = await import('../src/middleware');
  const res = await middleware(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.deepEqual(data, { error: 'Unauthorized (api)' });
  console.log('expired token api test passed');
}

async function run() {
  await testValidTokenRedirect('/');
  await testValidTokenRedirect('/login');
  await testLandingPageExpiredTokenRefresh();
  await testExpiredTokenPageRewrite();
  await testExpiredTokenApiUnauthorized();
}

run();
