import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  signRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../src/auth/service';
import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN } from '../src/auth/cookies';
import { NextResponse } from 'next/server.js';

// Generate temporary RSA keys for JWT signing
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

const claims = {
  userId: 'user1',
  siteId: 'site1',
  role: 'member',
  firstName: 'Test',
  lastName: 'User',
};

async function testRefreshRotation() {
  const token = signRefreshToken(claims);
  const access = signAccessToken(claims);
  const newRefresh = rotateRefreshToken(claims);
  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, access, newRefresh);
  const cookie = res.cookies.get(REFRESH_TOKEN);
  assert.ok(cookie);
  assert.equal(cookie?.path, '/api/auth/refresh');
  assert.notEqual(cookie?.value, token);
  console.log('refresh rotation test passed');
}

async function testLogout() {
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  const cookie = res.cookies.get(REFRESH_TOKEN);
  assert.ok(cookie);
  assert.equal(cookie?.path, '/api/auth/refresh');
  assert.equal(cookie?.value, '');
  assert.equal(cookie?.maxAge, 0);
  console.log('logout test passed');
}

async function run() {
  await testRefreshRotation();
  await testLogout();
}

run();
