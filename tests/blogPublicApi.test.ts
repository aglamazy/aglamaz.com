// Verifies src/proxy.ts's PUBLIC_API_PATTERNS exemption for the public blog read surface
// (list + single post) - added alongside src/app/api/site/[siteId]/blog/public/route.ts
// (scout#169: Shofar needs to enumerate a site's published posts with no session cookie).
// Both route handlers filter to isPublic+published themselves; this only checks the
// middleware lets an unauthenticated request THROUGH to them, and that unrelated
// member-only routes remain gated.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { NextRequest } from 'next/server.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();
process.env.NEXT_SITE_ID = 'site1';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;

async function testPublicBlogListPassesWithNoSession() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/api/site/site1/blog/public');
  const res = await proxy(req);
  assert.notEqual(res.status, 401, 'unauthenticated blog list request must not be gated by the middleware');
  console.log('unauthenticated GET /api/site/{siteId}/blog/public passes the middleware gate passed');
}

async function testPublicBlogSinglePostPassesWithNoSession() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/api/site/site1/blog/public/post1');
  const res = await proxy(req);
  assert.notEqual(res.status, 401, 'unauthenticated single-post request must not be gated by the middleware');
  console.log('unauthenticated GET /api/site/{siteId}/blog/public/{postId} passes the middleware gate passed');
}

async function testMemberOnlyBlogRouteStaysGated() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/api/site/site1/blog');
  const res = await proxy(req);
  assert.equal(res.status, 401, 'the member-only /blog route must still 401 with no session (regression guard on the new public-path regex)');
  console.log('unauthenticated GET /api/site/{siteId}/blog (member-only) still 401s passed');
}

async function run() {
  await testPublicBlogListPassesWithNoSession();
  await testPublicBlogSinglePostPassesWithNoSession();
  await testMemberOnlyBlogRouteStaysGated();
}

run();
