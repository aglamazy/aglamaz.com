import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_APP_URL = 'https://aglamaz.com';

async function testSubmitsCandidateDraftAndRequestsReview() {
  const { ShofarBlogSubmissionService } = await import('../src/services/ShofarBlogSubmissionService');

  const siteRepository: any = {
    get: async (siteId: string) => ({
      id: siteId,
      name: 'Aglamaz',
      defaultLocale: 'en',
    }),
  };

  const admin: any = {
    id: 'member1',
    uid: 'uid-admin-1',
    email: 'admin@example.com',
    firstName: 'Agla',
    displayName: 'Agla',
    role: 'admin',
  };
  const memberRepository: any = {
    listBySite: async (_siteId: string, opts: any) => {
      assert.deepEqual(opts, { roles: ['admin'] });
      return [admin];
    },
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

  const service = new ShofarBlogSubmissionService(siteRepository, memberRepository, blogRepository);

  const result = await service.submitCandidate('site1', {
    title: 'A day at the beach',
    content: 'We had a wonderful time together.',
  });

  assert.equal(result.outcome, 'created');
  assert.equal(result.siteId, 'site1');
  assert.equal(result.postId, 'post-1');
  assert.equal(result.reviewToken, 'review-token-123');

  // Hard rule: must be created as a draft, never published directly.
  assert.equal(createdPost.status, 'draft');
  assert.equal(createdPost.authorId, 'uid-admin-1');
  assert.equal(createdPost.siteId, 'site1');
  assert.equal(createdPost.primaryLocale, 'en');
  assert.equal(createdPost.contentFormat, 'md');
  assert.equal(createdPost.localeContent.title, 'A day at the beach');
  assert.equal(createdPost.localeContent.content, 'We had a wonderful time together.');

  // Flows into the EXISTING review-by-token mechanism.
  assert.equal(requestReviewCalledWith, 'post-1');

  console.log('ShofarBlogSubmissionService generates draft + requests review test passed');
}

async function testSkipsWhenNoLocale() {
  const { ShofarBlogSubmissionService } = await import('../src/services/ShofarBlogSubmissionService');

  const siteRepository: any = { get: async () => ({ id: 'site1' }) };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post when the site has no defaultLocale');
    },
  };

  const service = new ShofarBlogSubmissionService(siteRepository, {} as any, blogRepository);

  const result = await service.submitCandidate('site1', { title: 't', content: 'c' });
  assert.equal(result.outcome, 'skipped_no_locale');
  console.log('ShofarBlogSubmissionService no-locale skip test passed');
}

async function testSkipsWhenNoAdmin() {
  const { ShofarBlogSubmissionService } = await import('../src/services/ShofarBlogSubmissionService');

  const siteRepository: any = { get: async () => ({ id: 'site1', defaultLocale: 'en' }) };
  const memberRepository: any = { listBySite: async () => [] };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post when there is no admin to attribute authorship to');
    },
  };

  const service = new ShofarBlogSubmissionService(siteRepository, memberRepository, blogRepository);

  const result = await service.submitCandidate('site1', { title: 't', content: 'c' });
  assert.equal(result.outcome, 'skipped_no_admin');
  console.log('ShofarBlogSubmissionService no-admin skip test passed');
}

async function run() {
  await testSubmitsCandidateDraftAndRequestsReview();
  await testSkipsWhenNoLocale();
  await testSkipsWhenNoAdmin();
}

run();
