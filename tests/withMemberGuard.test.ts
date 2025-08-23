import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { signAccessToken } from '../src/auth/service';
import { NextResponse } from 'next/server.js';

// Setup env keys for JWT and Firebase admin
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.NEXT_SITE_ID = 'site1';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;

const claims = {
  userId: 'user1',
  siteId: 'site1',
  role: 'member',
  firstName: 'Test',
  lastName: 'User',
};

let withMemberGuard: any;
let __setMockCookies: any;
let __setMockDb: any;

async function testExpiredToken() {
  const token = signAccessToken(claims, -5); // expired
  __setMockCookies(() => ({ get: () => ({ value: token }) }));
  let called = false;
  const handler = () => { called = true; return NextResponse.json({ ok: true }); };
  const guarded = withMemberGuard(handler);
  const res = await guarded(new Request('https://example.com'), {} as any);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Unauthorized (withMG, np)');
  assert.equal(called, false);
  console.log('expired token test passed');
}

async function testValidToken() {
  const token = signAccessToken(claims); // valid
  __setMockCookies(() => ({ get: () => ({ value: token }) }));
  const memberSnap = {
    empty: false,
    docs: [{ data: () => ({ uid: 'user1', role: 'member' }) }],
  };
  const members: any = {
    where: () => members,
    limit: () => members,
    get: async () => memberSnap,
    withConverter: () => members,
  };
  __setMockDb({ collection: () => members });
  let called = false;
  let capturedUser: any;
  let capturedMember: any;
  const handler = (_req: Request, ctx: any) => {
    called = true;
    capturedUser = ctx.user;
    capturedMember = ctx.member;
    return NextResponse.json({ ok: true });
  };
  const guarded = withMemberGuard(handler);
  const res = await guarded(new Request('https://example.com'), {} as any);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(called, true);
  assert.equal(capturedUser.userId, 'user1');
  assert.equal(capturedMember.uid, 'user1');
  console.log('valid token test passed');
}

async function run() {
  const mod = await import('../src/lib/withMemberGuard');
  withMemberGuard = mod.withMemberGuard;
  __setMockCookies = mod.__setMockCookies;
  __setMockDb = mod.__setMockDb;
  await testExpiredToken();
  await testValidToken();
}

run();
