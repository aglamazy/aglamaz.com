import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key';
process.env.NEXT_PUBLIC_APP_URL = 'https://example.famcircle.org';

async function testGeneratesDraftAndRequestsReview() {
  const { BlogAutogenService } = await import('../src/services/BlogAutogenService');
  const { DigestCompilerService } = await import('../src/services/DigestCompilerService');

  const mockEvent = {
    id: 'e1',
    siteId: 'site1',
    ownerId: 'owner1',
    name: 'Grandma\'s 80th birthday',
    description: 'A big family gathering in the garden',
    type: 'birthday',
    date: new Date('2026-06-15'),
    month: 5,
    day: 15,
    year: 2026,
    isAnnual: false,
  } as any;

  const siteRepository: any = {
    get: async (siteId: string) => ({
      id: siteId,
      name: 'The Cohen Family',
      defaultLocale: 'en',
      blogAutogenEnabled: true,
    }),
  };

  const admin: any = {
    id: 'member1',
    uid: 'uid-admin-1',
    email: 'admin@example.com',
    firstName: 'Dana',
    displayName: 'Dana Cohen',
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

  // Real DigestCompilerService, but with fake underlying repos - this exercises the
  // actual seed-data path (same one DigestSendExecutionService uses), not a stub of it.
  const digestCompilerService = new DigestCompilerService(
    { getEventsForMonth: async () => [mockEvent] } as any,
    { listBySite: async () => [], listByAnniversary: async () => [] } as any,
    { listByEvent: async () => [] } as any,
    { create: async () => ({ slug: 'grandmas-80th', isPublic: false }) } as any,
  );

  let alreadyGeneratedCalledWith: [string, string] | undefined;
  let markGeneratedCalledWith: [string, string, string] | undefined;
  const blogAutogenRepository: any = {
    alreadyGenerated: async (siteId: string, periodKey: string) => {
      alreadyGeneratedCalledWith = [siteId, periodKey];
      return false;
    },
    markGenerated: async (siteId: string, periodKey: string, postId: string) => {
      markGeneratedCalledWith = [siteId, periodKey, postId];
    },
  };

  const service = new BlogAutogenService(
    siteRepository,
    memberRepository,
    blogRepository,
    digestCompilerService,
    blogAutogenRepository,
  );

  const originalFetch = global.fetch;
  let capturedOpenAiBody: any;
  global.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.openai.com')) {
      capturedOpenAiBody = JSON.parse(init!.body as string);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Grandma's Big Day",
                  content: 'We celebrated a wonderful birthday in the garden together.',
                }),
              },
            },
          ],
        }),
      } as Response;
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }) as typeof fetch;

  try {
    const result = await service.generateForSite('site1', new Date('2026-07-10'));

    assert.equal(result.outcome, 'created');
    assert.equal(result.siteId, 'site1');
    assert.equal(result.periodKey, '2026-07');
    assert.equal(result.postId, 'post-1');

    // Hard rule: must be created as a draft, never published directly.
    assert.equal(createdPost.status, 'draft');
    assert.equal(createdPost.authorId, 'uid-admin-1');
    assert.equal(createdPost.siteId, 'site1');
    assert.equal(createdPost.primaryLocale, 'en');
    assert.equal(createdPost.contentFormat, 'md');
    assert.equal(createdPost.localeContent.engine, 'gpt');
    assert.equal(createdPost.localeContent.title, "Grandma's Big Day");
    assert.ok(createdPost.localeContent.content.length > 0);

    // Flows into the EXISTING review-by-token mechanism.
    assert.equal(requestReviewCalledWith, 'post-1');

    // Idempotency bookkeeping.
    assert.deepEqual(alreadyGeneratedCalledWith, ['site1', '2026-07']);
    assert.deepEqual(markGeneratedCalledWith, ['site1', '2026-07', 'post-1']);

    // Prompt was actually seeded from the real per-site event data, not invented.
    const userMessage = capturedOpenAiBody.messages.find((m: any) => m.role === 'user');
    assert.ok(userMessage.content.includes("Grandma's 80th birthday"));
    assert.ok(userMessage.content.includes('The Cohen Family'));
    assert.equal(capturedOpenAiBody.response_format?.type, 'json_object');

    console.log('BlogAutogenService generates draft + requests review test passed');
  } finally {
    global.fetch = originalFetch;
  }
}

async function testSkipsWhenAlreadyGeneratedThisPeriod() {
  const { BlogAutogenService } = await import('../src/services/BlogAutogenService');

  const blogAutogenRepository: any = {
    alreadyGenerated: async () => true,
  };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post when already generated this period');
    },
  };

  const service = new BlogAutogenService(
    {} as any,
    {} as any,
    blogRepository,
    {} as any,
    blogAutogenRepository,
  );

  const result = await service.generateForSite('site1', new Date('2026-07-10'));
  assert.equal(result.outcome, 'skipped_duplicate');
  console.log('BlogAutogenService dedup skip test passed');
}

async function testSkipsWhenNoActivity() {
  const { BlogAutogenService } = await import('../src/services/BlogAutogenService');

  const siteRepository: any = {
    get: async () => ({ id: 'site1', defaultLocale: 'en', blogAutogenEnabled: true }),
  };
  const digestCompilerService: any = {
    compileMonthlyDigest: async () => ({ pastEvents: [], comingEvents: [], photos: [] }),
  };
  const blogAutogenRepository: any = { alreadyGenerated: async () => false };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post when there is no recent activity');
    },
  };

  const service = new BlogAutogenService(
    siteRepository,
    {} as any,
    blogRepository,
    digestCompilerService,
    blogAutogenRepository,
  );

  const result = await service.generateForSite('site1', new Date('2026-07-10'));
  assert.equal(result.outcome, 'skipped_no_activity');
  console.log('BlogAutogenService no-activity skip test passed');
}

async function testSkipsWhenNotOptedIn() {
  const { BlogAutogenService } = await import('../src/services/BlogAutogenService');

  // No blogAutogenEnabled field at all - the real-world default for every existing site.
  const siteRepository: any = { get: async () => ({ id: 'site1', defaultLocale: 'en' }) };
  const blogAutogenRepository: any = { alreadyGenerated: async () => false };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post for a site that has not opted in');
    },
  };

  const service = new BlogAutogenService(
    siteRepository,
    {} as any,
    blogRepository,
    {} as any,
    blogAutogenRepository,
  );

  const result = await service.generateForSite('site1', new Date('2026-07-10'));
  assert.equal(result.outcome, 'skipped_not_opted_in');
  console.log('BlogAutogenService not-opted-in skip test passed');
}

async function testSkipsWhenSendSettingsTableTurnsBlogAutogenOff() {
  const { BlogAutogenService } = await import('../src/services/BlogAutogenService');

  // F7-A (famcircle#119): the new admin table is the ONE thing this checks now, and it
  // must win even over a (stale) legacy blogAutogenEnabled=true - no shadow config.
  const siteRepository: any = {
    get: async () => ({
      id: 'site1',
      defaultLocale: 'en',
      blogAutogenEnabled: true,
      sendSettings: { blogAutogen: { enabled: false } },
    }),
  };
  const blogAutogenRepository: any = { alreadyGenerated: async () => false };
  const blogRepository: any = {
    create: async () => {
      throw new Error('should not create a post when the send-settings table has this off');
    },
  };

  const service = new BlogAutogenService(
    siteRepository,
    {} as any,
    blogRepository,
    {} as any,
    blogAutogenRepository,
  );

  const result = await service.generateForSite('site1', new Date('2026-07-10'));
  assert.equal(result.outcome, 'skipped_not_opted_in');
  console.log('BlogAutogenService send-settings-off skip test passed');
}

async function run() {
  await testGeneratesDraftAndRequestsReview();
  await testSkipsWhenAlreadyGeneratedThisPeriod();
  await testSkipsWhenNoActivity();
  await testSkipsWhenNotOptedIn();
  await testSkipsWhenSendSettingsTableTurnsBlogAutogenOff();
}

run();
