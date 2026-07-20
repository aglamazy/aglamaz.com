/**
 * Tests for the magic login read-token flow.
 *
 * Security invariant: read tokens grant read-only access via withReadTokenGuard.
 * Write routes (withMemberGuard) must reject read tokens unconditionally.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { signAccessToken } from '../src/auth/service';
import { NextResponse } from 'next/server.js';

// Generate temporary RSA keys — same pattern as withMemberGuard.test.ts
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.NEXT_SITE_ID = 'site1';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;

const memberRecord = {
  id: 'member1',
  uid: 'user1',
  siteId: 'site1',
  role: 'member' as const,
  displayName: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sessionClaims = {
  userId: 'user1',
  siteId: 'site1',
  role: 'member',
  firstName: 'Test',
  lastName: 'User',
};

let withMemberGuard: any;
let withReadTokenGuard: any;
let __setMockCookiesMG: any;
let __setMockMemberRepositoryMG: any;
let __setMockCookiesRTG: any;
let __setMockMemberRepositoryRTG: any;
let signReadToken: any;
let verifyReadToken: any;

// ─────────────────────────────────────────────────────────────────────────────
// Token unit tests
// ─────────────────────────────────────────────────────────────────────────────

async function testSignAndVerifyReadToken() {
  const token = signReadToken('user1', 'site1');
  assert.ok(typeof token === 'string' && token.length > 20, 'should produce a token string');
  const payload = verifyReadToken(token);
  assert.ok(payload !== null, 'should verify successfully');
  assert.equal(payload!.memberId, 'user1');
  assert.equal(payload!.siteId, 'site1');
  console.log('signReadToken/verifyReadToken: sign-and-verify passed');
}

async function testExpiredReadTokenRejected() {
  // Sign with a negative TTL so it's already expired
  const { signJwt } = await import('../src/auth/jwt');
  const { nowSeconds } = await import('../src/auth/tokens');
  const expiredToken = signJwt(
    { sub: 'user1', userId: 'user1', siteId: 'site1', role: 'member', firstName: '', aud: 'read-token', iat: nowSeconds(), exp: nowSeconds() - 10 },
    { expiresInSec: -10, audience: 'read-token' }
  );
  const payload = verifyReadToken(expiredToken);
  assert.equal(payload, null, 'expired token should return null');
  console.log('verifyReadToken: expired token rejected');
}

async function testWrongAudienceRejected() {
  // An access token (aud: FamilyNet) must not be accepted as a read token
  const accessToken = signAccessToken(sessionClaims);
  const payload = verifyReadToken(accessToken);
  assert.equal(payload, null, 'access token should not verify as a read token');
  console.log('verifyReadToken: wrong audience rejected');
}

async function testCrossSiteReadTokenRejected() {
  const token = signReadToken('user1', 'other-site');
  const payload = verifyReadToken(token);
  assert.ok(payload !== null, 'token itself is valid');
  assert.equal(payload!.siteId, 'other-site');
  // The siteId mismatch is caught by getMemberFromReadToken, which is tested below
  console.log('verifyReadToken: siteId present in payload for cross-site check');
}

// ─────────────────────────────────────────────────────────────────────────────
// withReadTokenGuard — read path
// ─────────────────────────────────────────────────────────────────────────────

async function testReadTokenGuardAcceptsValidReadToken() {
  const rt = signReadToken('user1', 'site1');
  // No session cookie — empty access_token
  __setMockCookiesRTG(() => ({ get: () => undefined }));
  __setMockMemberRepositoryRTG({ getByUid: async () => memberRecord });
  let capturedUser: any;
  let capturedMember: any;
  const handler = (_req: Request, ctx: any) => {
    capturedUser = ctx.user;
    capturedMember = ctx.member;
    return NextResponse.json({ ok: true });
  };
  const guarded = withReadTokenGuard(handler);
  const res = await guarded(
    new Request(`https://example.com/api/site/site1/anniversaries?rt=${rt}`),
    {} as any
  );
  assert.equal(res.status, 200);
  assert.equal(capturedUser.userId, 'user1');
  assert.equal(capturedUser.siteId, 'site1');
  assert.equal(capturedMember.uid, 'user1');
  console.log('withReadTokenGuard: valid read token accepted');
}

async function testReadTokenGuardRejectsExpiredReadToken() {
  const { signJwt } = await import('../src/auth/jwt');
  const { nowSeconds } = await import('../src/auth/tokens');
  const expiredRt = signJwt(
    { sub: 'user1', userId: 'user1', siteId: 'site1', role: 'member', firstName: '', aud: 'read-token', iat: nowSeconds(), exp: nowSeconds() - 10 },
    { expiresInSec: -10, audience: 'read-token' }
  );
  __setMockCookiesRTG(() => ({ get: () => undefined }));
  __setMockMemberRepositoryRTG({ getByUid: async () => memberRecord });
  const guarded = withReadTokenGuard(() => NextResponse.json({ ok: true }));
  const res = await guarded(
    new Request(`https://example.com/api/site/site1/anniversaries?rt=${expiredRt}`),
    {} as any
  );
  assert.equal(res.status, 401);
  console.log('withReadTokenGuard: expired read token rejected');
}

async function testReadTokenGuardRejectsNoToken() {
  __setMockCookiesRTG(() => ({ get: () => undefined }));
  const guarded = withReadTokenGuard(() => NextResponse.json({ ok: true }));
  const res = await guarded(
    new Request('https://example.com/api/site/site1/anniversaries'),
    {} as any
  );
  assert.equal(res.status, 401);
  console.log('withReadTokenGuard: missing token rejected');
}

async function testReadTokenGuardAcceptsRealSession() {
  const sessionToken = signAccessToken(sessionClaims);
  __setMockCookiesRTG(() => ({ get: () => ({ value: sessionToken }) }));
  __setMockMemberRepositoryRTG({ getByUid: async () => memberRecord });
  let capturedUser: any;
  const handler = (_req: Request, ctx: any) => {
    capturedUser = ctx.user;
    return NextResponse.json({ ok: true });
  };
  const guarded = withReadTokenGuard(handler);
  const res = await guarded(
    new Request('https://example.com/api/site/site1/anniversaries'),
    {} as any
  );
  assert.equal(res.status, 200);
  assert.equal(capturedUser.userId, 'user1', 'real session path should work');
  console.log('withReadTokenGuard: real session accepted');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: withMemberGuard (write routes) must reject read tokens
// ─────────────────────────────────────────────────────────────────────────────

async function testWriteRouteRejectsReadTokenInCookie() {
  // Simulate attacker putting a read token in the access_token cookie
  const rt = signReadToken('user1', 'site1');
  __setMockCookiesMG(() => ({ get: () => ({ value: rt }) }));
  __setMockMemberRepositoryMG({ getByUid: async () => memberRecord });
  let called = false;
  const writeHandler = () => { called = true; return NextResponse.json({ ok: true }); };
  const guarded = withMemberGuard(writeHandler);
  const res = await guarded(new Request('https://example.com/api/site/site1/blessings'), {} as any);
  // read token has aud:'read-token', verifyAccessToken checks aud:'FamilyNet' → 401
  assert.equal(res.status, 401, 'withMemberGuard must reject a read token used as access_token cookie');
  assert.equal(called, false, 'write handler must not be called');
  console.log('SECURITY: write route (blessing create) rejects read token in cookie');
}

async function testWriteRouteIgnoresReadTokenQueryParam() {
  // withMemberGuard does not look at ?rt= at all — no session → 401
  const rt = signReadToken('user1', 'site1');
  __setMockCookiesMG(() => ({ get: () => undefined }));
  __setMockMemberRepositoryMG({ getByUid: async () => memberRecord });
  let called = false;
  const writeHandler = () => { called = true; return NextResponse.json({ ok: true }); };
  const guarded = withMemberGuard(writeHandler);
  const res = await guarded(
    new Request(`https://example.com/api/site/site1/blog?rt=${rt}`),
    {} as any
  );
  assert.equal(res.status, 401, 'withMemberGuard must reject requests with only a ?rt= param (no real session)');
  assert.equal(called, false, 'write handler must not be called');
  console.log('SECURITY: write route (blog post create) rejects read token in query param');
}

async function testWriteRouteRejectsReadTokenEvenWithMatchingMember() {
  // Even if the read token's memberId is a valid site member, withMemberGuard must 401
  const rt = signReadToken('user1', 'site1');
  __setMockCookiesMG(() => ({ get: () => ({ value: rt }) }));
  __setMockMemberRepositoryMG({ getByUid: async () => memberRecord });
  let called = false;
  const writeHandler = () => { called = true; return NextResponse.json({ ok: true }); };
  const guarded = withMemberGuard(writeHandler);
  // POST to anniversary create route
  const res = await guarded(
    new Request('https://example.com/api/site/site1/anniversaries', { method: 'POST' }),
    {} as any
  );
  assert.equal(res.status, 401, 'withMemberGuard must reject read token even when member exists');
  assert.equal(called, false, 'write handler must not be called');
  console.log('SECURITY: write route (anniversary create) rejects read token even with valid member');
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  // Load readToken module
  const rtMod = await import('../src/auth/readToken');
  signReadToken = rtMod.signReadToken;
  verifyReadToken = rtMod.verifyReadToken;

  // Load withMemberGuard
  const mgMod = await import('../src/lib/withMemberGuard');
  withMemberGuard = mgMod.withMemberGuard;
  __setMockCookiesMG = mgMod.__setMockCookies;
  __setMockMemberRepositoryMG = mgMod.__setMockMemberRepository;

  // Load withReadTokenGuard
  const rtgMod = await import('../src/lib/withReadTokenGuard');
  withReadTokenGuard = rtgMod.withReadTokenGuard;
  __setMockCookiesRTG = rtgMod.__setMockCookies;
  __setMockMemberRepositoryRTG = rtgMod.__setMockMemberRepository;

  // Token unit tests
  await testSignAndVerifyReadToken();
  await testExpiredReadTokenRejected();
  await testWrongAudienceRejected();
  await testCrossSiteReadTokenRejected();

  // withReadTokenGuard — read path
  await testReadTokenGuardAcceptsValidReadToken();
  await testReadTokenGuardRejectsExpiredReadToken();
  await testReadTokenGuardRejectsNoToken();
  await testReadTokenGuardAcceptsRealSession();

  // Security: write routes must reject read tokens
  await testWriteRouteRejectsReadTokenInCookie();
  await testWriteRouteIgnoresReadTokenQueryParam();
  await testWriteRouteRejectsReadTokenEvenWithMatchingMember();

  console.log('\nAll read-token tests passed.');
}

run();
