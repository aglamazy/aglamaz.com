import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key';

async function testSuggestTemplateReturnsHtmlFromFixture() {
  const { MagazineTemplateSuggesterService } = await import('../src/services/MagazineTemplateSuggesterService');
  const { FIXTURE_MAGAZINE_SUGGEST_INPUT } = await import('../src/services/fixtures/magazineTemplateFixture');

  const fakeHtml = '```html\n<html><body>{{siteName}} - {{month}}</body></html>\n```';
  const originalFetch = global.fetch;
  let capturedBody: any;

  global.fetch = (async (_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(init!.body as string);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: fakeHtml } }] }),
    } as Response;
  }) as typeof fetch;

  try {
    assert.equal(MagazineTemplateSuggesterService.isEnabled(), true);

    const html = await MagazineTemplateSuggesterService.suggestTemplate(FIXTURE_MAGAZINE_SUGGEST_INPUT);

    assert.ok(html.length > 0, 'suggested template should be non-empty');
    assert.ok(!html.includes('```'), 'markdown fences should be stripped');
    assert.match(html, /<html>/);

    // Prior digest samples from the fixture should have reached the prompt
    const userMessage = capturedBody.messages.find((m: any) => m.role === 'user');
    assert.ok(userMessage.content.includes(FIXTURE_MAGAZINE_SUGGEST_INPUT.siteName));
    assert.ok(userMessage.content.includes('Sample 1'));

    console.log('magazine template suggester test passed');
  } finally {
    global.fetch = originalFetch;
  }
}

async function testSuggestTemplateThrowsOnEmptyResponse() {
  const { MagazineTemplateSuggesterService } = await import('../src/services/MagazineTemplateSuggesterService');
  const { FIXTURE_MAGAZINE_SUGGEST_INPUT } = await import('../src/services/fixtures/magazineTemplateFixture');

  const originalFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '   ' } }] }),
  })) as unknown as typeof fetch;

  try {
    await assert.rejects(
      () => MagazineTemplateSuggesterService.suggestTemplate(FIXTURE_MAGAZINE_SUGGEST_INPUT),
      /empty template/
    );
    console.log('magazine template suggester empty-response test passed');
  } finally {
    global.fetch = originalFetch;
  }
}

async function run() {
  await testSuggestTemplateReturnsHtmlFromFixture();
  await testSuggestTemplateThrowsOnEmptyResponse();
}

run();
