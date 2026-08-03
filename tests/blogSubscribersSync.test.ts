// Verifies the narrow, bearer-secret-guarded blog-subscribers/sync route (scout#169's
// ub04 Listmonk job) - both the route handler's own auth check and the middleware
// exemption that lets an unauthenticated request reach it in the first place.
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
process.env.BLOG_SUBSCRIBERS_SYNC_SECRET = 'test-sync-secret';

async function testMiddlewareLetsRequestThrough() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/api/site/site1/blog-subscribers/sync');
  const res = await proxy(req);
  assert.notEqual(res.status, 401, 'the middleware itself must not gate this route - the route handler does its own bearer check');
  console.log('middleware lets unauthenticated GET /blog-subscribers/sync through passed');
}

async function testMiddlewareDoesNotExemptTheAdminRoute() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/api/site/site1/blog-subscribers');
  const res = await proxy(req);
  assert.equal(res.status, 401, 'the sibling admin-guarded /blog-subscribers route (no /sync suffix) must stay gated - regression guard on the new regex');
  console.log('the admin blog-subscribers route (no /sync suffix) stays gated passed');
}

async function testRouteRejectsMissingBearer() {
  const routeMod = await import('../src/app/api/site/[siteId]/blog-subscribers/sync/route');
  const req = new NextRequest('https://example.com/api/site/site1/blog-subscribers/sync');
  const res = await routeMod.GET(req, { params: Promise.resolve({ siteId: 'site1' }) });
  assert.equal(res.status, 401, 'a request with no Authorization header must be rejected');
  console.log('blog-subscribers/sync route rejects a missing bearer secret passed');
}

async function testRouteRejectsWrongBearer() {
  const routeMod = await import('../src/app/api/site/[siteId]/blog-subscribers/sync/route');
  const req = new NextRequest('https://example.com/api/site/site1/blog-subscribers/sync', {
    headers: { Authorization: 'Bearer wrong-secret' },
  });
  const res = await routeMod.GET(req, { params: Promise.resolve({ siteId: 'site1' }) });
  assert.equal(res.status, 401, 'a request with the wrong bearer secret must be rejected');
  console.log('blog-subscribers/sync route rejects the wrong bearer secret passed');
}

async function run() {
  await testMiddlewareLetsRequestThrough();
  await testMiddlewareDoesNotExemptTheAdminRoute();
  await testRouteRejectsMissingBearer();
  await testRouteRejectsWrongBearer();
}

run();
