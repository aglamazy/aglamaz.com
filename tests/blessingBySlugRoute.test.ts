import assert from 'node:assert/strict';

const SITE_ID = 'site1';
const PUBLIC_SLUG = 'public-slug';
const PRIVATE_SLUG = 'private-slug';
const EVENT_ID = 'event-1';

function makeFakeBlessingPageRepo() {
  const pages: Record<string, any> = {
    [PUBLIC_SLUG]: { id: 'public-page-1', siteId: SITE_ID, eventId: EVENT_ID, isPublic: true, slug: PUBLIC_SLUG },
    [PRIVATE_SLUG]: { id: 'private-page-1', siteId: SITE_ID, eventId: EVENT_ID, isPublic: false, slug: PRIVATE_SLUG },
  };
  return {
    async getBySlug(slug: string) {
      return pages[slug] || null;
    },
  } as any;
}

function makeFakeAnniversaryRepo() {
  return {
    async getById(id: string) {
      if (id !== EVENT_ID) return null;
      return { id: EVENT_ID, siteId: SITE_ID, type: 'birthday' };
    },
  } as any;
}

let GET: any;
let __setMockBlessingPageRepository: any;
let __setMockAnniversaryRepository: any;

function makeRequest(slug: string) {
  return new Request(`https://example.com/api/site/${SITE_ID}/blessing/${slug}`);
}

async function testPublicBlessingPageReturns200WithData() {
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockAnniversaryRepository(makeFakeAnniversaryRepo());

  const res = await GET(makeRequest(PUBLIC_SLUG), { params: Promise.resolve({ siteId: SITE_ID, slug: PUBLIC_SLUG }) });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.blessingPage.slug, PUBLIC_SLUG);
  assert.equal(data.event.id, EVENT_ID);

  console.log('public blessing page returns 200 with data passed');
}

async function testNonPublicBlessingPageRespondsSameAsNonexistentSlug() {
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockAnniversaryRepository(makeFakeAnniversaryRepo());

  const privateRes = await GET(makeRequest(PRIVATE_SLUG), { params: Promise.resolve({ siteId: SITE_ID, slug: PRIVATE_SLUG }) });
  const missingRes = await GET(makeRequest('does-not-exist'), { params: Promise.resolve({ siteId: SITE_ID, slug: 'does-not-exist' }) });

  assert.equal(privateRes.status, 404);
  assert.equal(missingRes.status, 404);

  const privateBody = await privateRes.json();
  const missingBody = await missingRes.json();
  assert.deepEqual(privateBody, missingBody);

  console.log('non-public blessing page is indistinguishable from a nonexistent slug passed');
}

async function run() {
  const mod = await import('../src/app/api/site/[siteId]/blessing/[slug]/route');
  GET = mod.GET;
  __setMockBlessingPageRepository = mod.__setMockBlessingPageRepository;
  __setMockAnniversaryRepository = mod.__setMockAnniversaryRepository;

  await testPublicBlessingPageReturns200WithData();
  await testNonPublicBlessingPageRespondsSameAsNonexistentSlug();

  __setMockBlessingPageRepository(null);
  __setMockAnniversaryRepository(null);
}

run();
