// famcircle#125: page-level read-only-token auth for /app/* (magazine links w/o login).
// Verifies the wiring end-to-end at the unit level: the canonical ReadTokenService
// round-trips, the Edge-safe verifier used by src/proxy.ts (middleware runs in the Edge
// runtime, where verifyReadToken's Node `crypto` dependency is unavailable) agrees with it,
// and src/proxy.ts sets the RT_SESSION cookie + strips `rt` on success while falling through
// (no redirect, no throw) on an invalid token.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { NextRequest } from 'next/server.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
// SPKI, not PKCS1: jose's importSPKI (used by src/lib/edgeAuth.ts's Edge-runtime verifiers)
// requires a "BEGIN PUBLIC KEY" SPKI PEM, unlike Node's createVerify (used by
// src/auth/jwt.ts) which also accepts a "BEGIN RSA PUBLIC KEY" PKCS1 PEM.
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();
process.env.NEXT_SITE_ID = 'site1';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;

async function testReadTokenRoundTrip() {
  const { generateReadToken, verifyReadToken } = await import('../src/services/ReadTokenService');
  const token = generateReadToken({ memberId: 'member1', siteId: 'site1' });
  const claims = verifyReadToken(token);
  assert.ok(claims, 'verifyReadToken should accept a token minted via generateReadToken');
  assert.equal(claims?.memberId, 'member1');
  assert.equal(claims?.siteId, 'site1');
  console.log('verifyReadToken round-trips a generateReadToken token passed');
}

async function testEdgeVerifierAgreesWithNodeVerifier() {
  const { generateReadToken } = await import('../src/services/ReadTokenService');
  const { verifyReadTokenEdge } = await import('../src/lib/edgeAuth');

  const token = generateReadToken({ memberId: 'member2', siteId: 'site2' });
  const claims = await verifyReadTokenEdge(token);
  assert.ok(claims, 'verifyReadTokenEdge should accept the same token verifyReadToken accepts');
  assert.equal(claims?.memberId, 'member2');
  assert.equal(claims?.siteId, 'site2');

  const tampered = token.slice(0, -2) + (token.slice(-2) === 'AA' ? 'BB' : 'AA');
  const tamperedClaims = await verifyReadTokenEdge(tampered);
  assert.equal(tamperedClaims, null, 'a tampered token must be rejected');
  console.log('verifyReadTokenEdge (used by src/proxy.ts) agrees with verifyReadToken passed');
}

async function testProxyMatcherCoversAppRoutes() {
  const proxyMod = await import('../src/proxy');
  assert.ok(proxyMod.config?.matcher?.length, 'src/proxy.ts must export a config.matcher');
  const re = new RegExp(`^${proxyMod.config.matcher[0]}$`);
  assert.ok(re.test('/app/calendar'), 'proxy.ts matcher must cover /app/* paths');
  console.log('src/proxy.ts matcher covers /app/* paths passed');
}

async function testValidReadTokenSetsRtSessionCookieAndRedirects() {
  const { generateReadToken } = await import('../src/services/ReadTokenService');
  const { proxy } = await import('../src/proxy');
  const { RT_SESSION } = await import('../src/auth/cookies');

  const rt = generateReadToken({ memberId: 'member3', siteId: 'site3' });
  const req = new NextRequest(`https://example.com/app/calendar?rt=${rt}`);
  const res = await proxy(req);

  assert.ok(res, 'proxy() must return a response for a request carrying a valid rt token');
  assert.equal(res.status, 307, 'a valid rt token should trigger a redirect to strip it from the URL');

  const cookie = res.cookies.get(RT_SESSION);
  assert.ok(cookie, 'proxy() must set the RT_SESSION cookie on a valid rt token');
  assert.equal(cookie?.value, rt);
  assert.equal(cookie?.httpOnly, true);

  const location = res.headers.get('location');
  assert.ok(location, 'redirect response must carry a location header');
  assert.ok(!location!.includes('rt='), 'redirect target must have the rt param stripped');
  console.log('valid rt token sets RT_SESSION cookie and redirects with rt stripped passed');
}

async function testInvalidReadTokenFallsThroughWithoutRedirect() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/app/calendar?rt=garbage-not-a-jwt');
  const res = await proxy(req);

  assert.ok(res, 'proxy() must not throw on a garbage rt token');
  assert.notEqual(res.status, 307);
  assert.notEqual(res.status, 308);
  console.log('invalid rt token falls through to existing unauthenticated behavior (no redirect, no throw) passed');
}

// famcircle#138: a stale/expired access_token cookie must NOT silently block rt-processing.
// Before the fix, gating on "token present" rather than "token valid" meant ANY leftover
// access_token cookie (not just a real active session) dropped the rt param with no redirect,
// no RT_SESSION, no error — every visitor who ever logged in carries that cookie, so every
// weekly-digest magic link silently failed for them while working fine in incognito.
async function testStaleAccessTokenCookieDoesNotBlockReadToken() {
  const { generateReadToken } = await import('../src/services/ReadTokenService');
  const { proxy } = await import('../src/proxy');
  const { RT_SESSION, ACCESS_TOKEN } = await import('../src/auth/cookies');

  const rt = generateReadToken({ memberId: 'member4', siteId: 'site4' });
  const req = new NextRequest(`https://example.com/app/calendar?rt=${rt}`);
  req.cookies.set(ACCESS_TOKEN, 'stale-or-garbage-not-a-valid-jwt');
  const res = await proxy(req);

  assert.equal(res.status, 307, 'a valid rt token must still redirect+set RT_SESSION even with a stale access_token cookie present');
  const cookie = res.cookies.get(RT_SESSION);
  assert.ok(cookie, 'RT_SESSION must be set despite the stale access_token cookie');
  assert.equal(cookie?.value, rt);
  console.log('stale access_token cookie does not block rt-token processing (famcircle#138) passed');
}

// The flip side: a REAL, valid access_token means the visitor already has a real session —
// existing design intentionally ignores `rt` in that case (never overrides a real session with
// a read-only one).
async function testValidAccessTokenCookieSkipsReadTokenProcessing() {
  const { generateReadToken } = await import('../src/services/ReadTokenService');
  const { signAccessToken } = await import('../src/auth/service');
  const { proxy } = await import('../src/proxy');
  const { RT_SESSION, ACCESS_TOKEN } = await import('../src/auth/cookies');

  const rt = generateReadToken({ memberId: 'member5', siteId: 'site5' });
  const accessToken = signAccessToken({ userId: 'user1', siteId: 'site5', role: 'member', firstName: 'Test' });
  const req = new NextRequest(`https://example.com/app/calendar?rt=${rt}`);
  req.cookies.set(ACCESS_TOKEN, accessToken);
  const res = await proxy(req);

  assert.notEqual(res.status, 307, 'a real logged-in session must not be redirected for rt-processing');
  assert.ok(!res.cookies.get(RT_SESSION), 'RT_SESSION must not be set when a valid access_token cookie is already present');
  console.log('valid access_token cookie skips rt-token processing, keeps the real session (famcircle#138) passed');
}

async function run() {
  await testReadTokenRoundTrip();
  await testEdgeVerifierAgreesWithNodeVerifier();
  await testProxyMatcherCoversAppRoutes();
  await testValidReadTokenSetsRtSessionCookieAndRedirects();
  await testInvalidReadTokenFallsThroughWithoutRedirect();
  await testStaleAccessTokenCookieDoesNotBlockReadToken();
  await testValidAccessTokenCookieSkipsReadTokenProcessing();
}

run();
