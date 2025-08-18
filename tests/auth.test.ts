import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  signRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  setAuthCookies,
  clearAuthCookies,
} from '../src/lib/auth';
import { REFRESH_TOKEN } from '../src/constants';
import { NextResponse } from 'next/server.js';

// Generate temporary RSA keys for JWT signing
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

async function testRefreshRotation() {
  const token = signRefreshToken({ sub: 'user1' });
  const access = signAccessToken({ sub: 'user1' });
  const newRefresh = rotateRefreshToken('user1');
  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, access, newRefresh);
  const cookie = res.cookies.get(REFRESH_TOKEN);
  assert.ok(cookie);
  assert.equal(cookie?.path, '/');
  assert.notEqual(cookie?.value, token);
  console.log('refresh rotation test passed');
}

async function testLogout() {
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  const cookie = res.cookies.get(REFRESH_TOKEN);
  assert.ok(cookie);
  assert.equal(cookie?.path, '/');
  assert.equal(cookie?.value, '');
  assert.equal(cookie?.maxAge, 0);
  console.log('logout test passed');
}

async function run() {
  await testRefreshRotation();
  await testLogout();
}

run();
