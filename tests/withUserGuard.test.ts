import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { signAccessToken } from '../src/auth/service';
import { NextResponse } from 'next/server.js';

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

let withUserGuard: any;
let __setMockCookies: any;

async function testExpiredToken() {
  const token = signAccessToken(claims, -5);
  __setMockCookies(() => ({ get: () => ({ value: token }) }));
  let called = false;
  const handler = () => { called = true; return NextResponse.json({ ok: true }); };
  const guarded = withUserGuard(handler);
  const res = await guarded(new Request('https://example.com'), {} as any);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Unauthorized (withUG)');
  assert.equal(called, false);
  console.log('expired token test passed');
}

async function testValidToken() {
  const token = signAccessToken(claims);
  __setMockCookies(() => ({ get: () => ({ value: token }) }));
  let called = false;
  let capturedUser: any;
  const handler = (_req: Request, ctx: any) => {
    called = true;
    capturedUser = ctx.user;
    return NextResponse.json({ ok: true });
  };
  const guarded = withUserGuard(handler);
  const res = await guarded(new Request('https://example.com'), {} as any);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(called, true);
  assert.equal(capturedUser.userId, 'user1');
  console.log('valid token test passed');
}

async function run() {
  const mod = await import('../src/lib/withUserGuard');
  withUserGuard = mod.withUserGuard;
  __setMockCookies = mod.__setMockCookies;
  await testExpiredToken();
  await testValidToken();
}

run();
