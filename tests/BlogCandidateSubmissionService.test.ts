import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

process.env.NEXT_PUBLIC_APP_URL = 'https://aglamaz.com';
process.env.RESEND_API_KEY = 'test-key';
// EmailTrackingService signs a real RS256 JWT for the click/open tracking pixel - needs an
// actual key pair, not a placeholder string, for signJwt to succeed.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

async function testSubmitsCandidateAndRequestsReview() {
  const { BlogCandidateSubmissionService } = await import('../src/services/BlogCandidateSubmissionService');

  const siteRepository: any = {
    getIdByDomain: async (domain: string) => {
      assert.equal(domain, 'aglamaz.com');
      return 'aglamaz-com-site';
    },
    get: async (siteId: string) => ({
      id: siteId,
      name: 'Aglamaz',
      // main's ISite has no defaultLocale field - locale is derived from the locales map
      // (see BlogCandidateSubmissionService.submitCandidateForDomain).
      locales: { en: { name: 'Aglamaz' } },
      ownerUid: 'uid-owner-1',
    }),
  };

  let createdPost: any;
  let requestReviewCalledWith: string | undefined;
  const blogRepository: any = {
    create: async (post: any) => {
      createdPost = post;
      return { id: 'post-1', ...post, createdAt: new Date(), updatedAt: new Date() };
    },
    requestReview: async (postId: string) => {
      requestReviewCalledWith = postId;
      return 'review-token-123';
    },
  };

  const getUserEmail = async (uid: string) => {
    assert.equal(uid, 'uid-owner-1');
    return 'owner@example.com';
  };

  const service = new BlogCandidateSubmissionService(siteRepository, blogRepository, getUserEmail);

  const originalFetch = global.fetch;
  let capturedResendBody: any;
  global.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.resend.com')) {
      capturedResendBody = JSON.parse(init!.body as string);
      return { ok: true, json: async () => ({ id: 'email-1' }) } as Response;
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }) as typeof fetch;

  try {
    const result = await service.submitCandidateForDomain('aglamaz.com', {
      title: 'A candidate from Shofar',
      content: 'Body of the candidate post.',
    });

    assert.equal(result.siteId, 'aglamaz-com-site');
    assert.equal(result.postId, 'post-1');
    assert.equal(result.reviewToken, 'review-token-123');

    // Hard rule: must be created as a draft, never published directly.
    assert.equal(createdPost.status, 'draft');
    assert.equal(createdPost.authorId, 'uid-owner-1');
    assert.equal(createdPost.siteId, 'aglamaz-com-site');
    assert.equal(createdPost.primaryLocale, 'en');
    // Note: main's BlogRepository.create() has no contentFormat param yet (dev-only,
    // unmerged) - posts default to 'html' per BlogPost's back-compat rule until it lands.
    assert.equal(createdPost.localeContent.title, 'A candidate from Shofar');
    assert.equal(createdPost.localeContent.content, 'Body of the candidate post.');

    // Flows into the EXISTING review-by-token mechanism.
    assert.equal(requestReviewCalledWith, 'post-1');

    // Notification actually went out, to the resolved owner email, with a review link.
    assert.deepEqual(capturedResendBody.to, ['owner@example.com']);
    assert.ok(capturedResendBody.html.includes('/review/review-token-123'));

    console.log('BlogCandidateSubmissionService submits + requests review test passed');
  } finally {
    global.fetch = originalFetch;
  }
}

async function testThrowsWhenDomainDoesNotResolveToASite() {
  const { BlogCandidateSubmissionService } = await import('../src/services/BlogCandidateSubmissionService');

  const originalEnvSiteId = process.env.NEXT_SITE_ID;
  delete process.env.NEXT_SITE_ID;

  const siteRepository: any = { getIdByDomain: async () => null };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post when the domain does not resolve to a site');
    },
  };

  const service = new BlogCandidateSubmissionService(siteRepository, blogRepository, async () => null);

  try {
    await assert.rejects(
      () => service.submitCandidateForDomain('aglamaz.com', { title: 'T', content: 'C' }),
      /Could not resolve siteId/,
    );
    console.log('BlogCandidateSubmissionService unresolved-domain test passed');
  } finally {
    if (originalEnvSiteId !== undefined) process.env.NEXT_SITE_ID = originalEnvSiteId;
  }
}

async function testRejectsEmptyCandidate() {
  const { BlogCandidateSubmissionService } = await import('../src/services/BlogCandidateSubmissionService');

  const service = new BlogCandidateSubmissionService({} as any, {} as any, async () => null);

  await assert.rejects(
    () => service.submitCandidateForDomain('aglamaz.com', { title: '  ', content: 'C' }),
    /non-empty title and content/,
  );
  console.log('BlogCandidateSubmissionService empty-candidate test passed');
}

async function run() {
  await testSubmitsCandidateAndRequestsReview();
  await testThrowsWhenDomainDoesNotResolveToASite();
  await testRejectsEmptyCandidate();
}

run();
