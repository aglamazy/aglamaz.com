import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { NextResponse } from 'next/server.js';
import { signReadOnlyAccessToken } from '../src/auth/readOnly';
import { signAccessToken } from '../src/auth/service';
import { ACCESS_TOKEN } from '../src/auth/cookies';
import { READ_ONLY_ACCESS_TOKEN } from '../src/auth/readOnlyShared';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.NEXT_SITE_ID = 'site1';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;

const readOnlyToken = signReadOnlyAccessToken({ memberId: 'member-doc-1', siteId: 'site1' });
const fullAccessClaims = {
  userId: 'user1',
  siteId: 'site1',
  role: 'member',
  firstName: 'Test',
  lastName: 'User',
};

let __setMockCookies: any;
let __setMockMemberRepository: any;

function cookieStoreFor(tokenName: string, tokenValue: string) {
  return {
    get(name: string) {
      if (name === tokenName) {
        return { value: tokenValue };
      }
      return undefined;
    },
  };
}

async function testReadOnlyTokenResolvesMember() {
  __setMockCookies(() => cookieStoreFor(READ_ONLY_ACCESS_TOKEN, readOnlyToken));
  __setMockMemberRepository({
    getById: async () => ({
      id: 'member-doc-1',
      uid: 'firebase-user-1',
      siteId: 'site1',
      role: 'member',
      displayName: 'Read Only',
      firstName: 'Read',
      email: 'read@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  let called = false;
  let capturedUser: any;
  let capturedMember: any;
  const guarded = withMemberGuard(async (_req: Request, context: any) => {
    called = true;
    capturedUser = context.user;
    capturedMember = context.member;
    return NextResponse.json({ ok: true });
  });

  const res = await guarded(new Request('https://example.com/api/site/site1/photos', { method: 'GET' }), {
    params: Promise.resolve({ siteId: 'site1' }),
  } as any);

  assert.equal(res.status, 200);
  assert.equal(called, true);
  assert.equal(capturedUser.userId, 'firebase-user-1');
  assert.equal(capturedMember.id, 'member-doc-1');
}

async function testWriteRouteRejected(
  name: string,
  handler: (request: Request, context: any) => Promise<Response>,
  request: Request,
  expectedError: string,
) {
  __setMockCookies(() => cookieStoreFor(READ_ONLY_ACCESS_TOKEN, readOnlyToken));
  __setMockMemberRepository(null);

  const res = await handler(request, {
    params: Promise.resolve({ siteId: 'site1', blessingPageId: 'bp1', photoId: 'photo1' }),
  } as any);

  assert.equal(res.status, 401, `${name} should reject read-only auth`);
  const body = await res.json();
  assert.equal(body.error, expectedError, `${name} should match the unauthenticated error body`);
}

let withMemberGuard: any;
let blogPost: any;
let photosPost: any;
let anniversariesPost: any;
let profilePut: any;
let withUserGuard: any;

async function testWriteRoutesBlocked() {
  await testWriteRouteRejected(
    'blog post create',
    blogPost,
    new Request('https://example.com/api/site/site1/blog', {
      method: 'POST',
      body: JSON.stringify({ title: 'x', content: 'y' }),
      headers: { 'content-type': 'application/json' },
    }),
    'Unauthorized (withMG, np)',
  );

  await testWriteRouteRejected(
    'gallery photo create',
    photosPost,
    new Request('https://example.com/api/site/site1/photos', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-07-20', images: ['https://example.com/a.jpg'], locale: 'en' }),
      headers: { 'content-type': 'application/json' },
    }),
    'Unauthorized (withMG, np)',
  );

  await testWriteRouteRejected(
    'profile update',
    profilePut,
    new Request('https://example.com/api/site/site1/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName: 'New Name' }),
      headers: { 'content-type': 'application/json' },
    }),
    'Unauthorized (withUG)',
  );

  await testWriteRouteRejected(
    'anniversary create',
    anniversariesPost,
    new Request('https://example.com/api/site/site1/anniversaries', {
      method: 'POST',
      body: JSON.stringify({ name: 'Event', type: 'birthday', date: '2026-07-20' }),
      headers: { 'content-type': 'application/json' },
    }),
    'Unauthorized (withMG, np)',
  );
}

async function run() {
  const guardMod = await import('../src/lib/withMemberGuard');
  withMemberGuard = guardMod.withMemberGuard;
  __setMockCookies = guardMod.__setMockCookies;
  __setMockMemberRepository = guardMod.__setMockMemberRepository;

  const blogRoute = await import('../src/app/api/site/[siteId]/blog/route');
  const photosRoute = await import('../src/app/api/site/[siteId]/photos/route');
  const anniversariesRoute = await import('../src/app/api/site/[siteId]/anniversaries/route');
  const profileRoute = await import('../src/app/api/site/[siteId]/profile/route');
  blogPost = blogRoute.POST;
  photosPost = photosRoute.POST;
  anniversariesPost = anniversariesRoute.POST;
  profilePut = profileRoute.PUT;
  withUserGuard = (await import('../src/lib/withUserGuard')).withUserGuard;

  await testReadOnlyTokenResolvesMember();
  await testWriteRoutesBlocked();

  const accessToken = signAccessToken(fullAccessClaims);
  __setMockCookies(() => cookieStoreFor(ACCESS_TOKEN, accessToken));
  const guarded = withUserGuard(async () => NextResponse.json({ ok: true }));
  const res = await guarded(new Request('https://example.com/api/site/site1/profile', { method: 'GET' }), {} as any);
  assert.equal(res.status, 200);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
