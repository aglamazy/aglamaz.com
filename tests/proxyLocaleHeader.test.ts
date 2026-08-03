// Regression test for a rescued stranded fix (hopper #3914, famcircle#113): src/proxy.ts's
// ?locale= handling used to set x-locale on the outgoing RESPONSE only, which never reaches
// the actual downstream request - Server Components (headers()) and API routes
// (request.headers.get('x-locale')) never saw it. NextResponse.next({request:{headers}})
// signals the override via x-middleware-request-<header> on the returned response; that's
// what Next.js's runtime reads to actually inject it into the downstream request.
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

async function testLocaleQueryParamForwardedAsRequestHeader() {
  const { proxy } = await import('../src/proxy');
  // /en/blog (already locale-prefixed) so this reaches the isPublic branch directly, rather
  // than /blog which 308-redirects to /{locale}/blog before ever hitting withLocaleHeader.
  const req = new NextRequest('https://example.com/en/blog?locale=tr');
  const res = await proxy(req);

  assert.equal(
    res.headers.get('x-middleware-request-x-locale'),
    'tr',
    '?locale=tr must be forwarded as an x-locale REQUEST header (not just set on the response)',
  );
  console.log('?locale= query param is forwarded to the downstream request passed');
}

async function testNoLocaleParamMeansNoOverride() {
  const { proxy } = await import('../src/proxy');
  const req = new NextRequest('https://example.com/en/blog');
  const res = await proxy(req);

  assert.equal(res.headers.get('x-middleware-request-x-locale'), null, 'no ?locale= param means no request-header override at all');
  console.log('no ?locale= param means no x-locale override passed');
}

async function run() {
  await testLocaleQueryParamForwardedAsRequestHeader();
  await testNoLocaleParamMeansNoOverride();
}

run();
