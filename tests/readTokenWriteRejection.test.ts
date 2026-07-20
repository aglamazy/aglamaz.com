// SECURITY-CRITICAL (famcircle#63): proves that write-capable routes reject a read-token-only
// request (docs/family-digest-formats-spec.md §7's read-token grants READ access only) exactly
// as they reject a fully unauthenticated request. withMemberGuard/withUserGuard never look at
// `rt` at all, so this is a regression guard against a future change accidentally teaching them
// to accept it.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.NEXT_SITE_ID = 'site1';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;

type RouteHandler = (request: Request, context: any) => Response | Promise<Response>;

async function assertRejectedLikeUnauthenticated(
  name: string,
  handler: RouteHandler,
  url: string,
  method: string,
  body: unknown,
  generateReadToken: (params: { memberId: string; siteId: string }) => string,
) {
  const init = (u: string) => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const unauthenticatedRes = await handler(new Request(url, init(url)), {} as any);
  const unauthenticatedBody = await unauthenticatedRes.json();

  assert.equal(unauthenticatedRes.status, 401, `${name}: fully-unauthenticated baseline should be 401`);

  const rt = generateReadToken({ memberId: 'member1', siteId: 'site1' });
  const rtUrl = `${url}${url.includes('?') ? '&' : '?'}rt=${rt}`;
  const rtRes = await handler(new Request(rtUrl, init(rtUrl)), {} as any);
  const rtBody = await rtRes.json();

  assert.equal(rtRes.status, unauthenticatedRes.status, `${name}: read-token-only status must match unauthenticated status`);
  assert.deepEqual(rtBody, unauthenticatedBody, `${name}: read-token-only body must match unauthenticated body`);
  console.log(`${name}: read-token-only request rejected exactly like unauthenticated (status ${rtRes.status})`);
}

async function run() {
  const memberGuardMod = await import('../src/lib/withMemberGuard');
  const userGuardMod = await import('../src/lib/withUserGuard');
  const tokenMod = await import('../src/services/ReadTokenService');

  // No session cookie for either guard's shared cookie state.
  memberGuardMod.__setMockCookies(() => ({ get: () => undefined }));
  userGuardMod.__setMockCookies(() => ({ get: () => undefined }));
  memberGuardMod.__setMockMemberRepository({ getByUid: async () => null });

  const blessingRoute = await import(
    '../src/app/api/site/[siteId]/blessing-pages/[blessingPageId]/blessings/route'
  );
  const blogRoute = await import('../src/app/api/site/[siteId]/blog/route');
  const profileRoute = await import('../src/app/api/user/profile/route');

  await assertRejectedLikeUnauthenticated(
    'blessing create (POST)',
    blessingRoute.POST,
    'https://example.com/api/site/site1/blessing-pages/bp1/blessings',
    'POST',
    { text: 'hello' },
    tokenMod.generateReadToken,
  );

  await assertRejectedLikeUnauthenticated(
    'blog post create (POST)',
    blogRoute.POST,
    'https://example.com/api/site/site1/blog',
    'POST',
    { title: 'x', content: 'y' },
    tokenMod.generateReadToken,
  );

  await assertRejectedLikeUnauthenticated(
    'profile update (PUT)',
    profileRoute.PUT,
    'https://example.com/api/user/profile?siteId=site1',
    'PUT',
    { displayName: 'New Name' },
    tokenMod.generateReadToken,
  );
}

run();
