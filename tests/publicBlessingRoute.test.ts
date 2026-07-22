import assert from 'node:assert/strict';
import { BlessingRepository } from '../src/repositories/BlessingRepository';
import { makeFakeFirestore } from './helpers/fakeFirestore';
import { __resetRateLimitStore } from '../src/lib/rateLimit';

const SITE_ID = 'site1';
const PUBLIC_PAGE_ID = 'public-page-1';
const PRIVATE_PAGE_ID = 'private-page-1';

function makeFakeBlessingPageRepo() {
  const pages: Record<string, any> = {
    [PUBLIC_PAGE_ID]: { id: PUBLIC_PAGE_ID, siteId: SITE_ID, isPublic: true, slug: 'public-slug' },
    [PRIVATE_PAGE_ID]: { id: PRIVATE_PAGE_ID, siteId: SITE_ID, isPublic: false, slug: 'private-slug' },
  };
  return {
    async getById(id: string) {
      return pages[id] || null;
    },
  } as any;
}

function makeRequest(body: any, headers: Record<string, string> = {}) {
  return new Request('https://example.com/api/site/site1/blessing-pages/public-page-1/blessings/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

let POST: any;
let __setMockBlessingPageRepository: any;
let __setMockBlessingRepository: any;
let __setMockNotify: any;

async function testNonMemberCanPostToPublicPage() {
  __resetRateLimitStore();
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockBlessingRepository(new BlessingRepository(fakeDb));
  let notified: any = null;
  __setMockNotify(async (eventType: string, payload: any) => {
    notified = { eventType, payload };
  });

  const res = await POST(
    makeRequest(
      { authorName: 'A Visitor', guestEmail: 'visitor@example.com', content: 'A lovely memory' },
      { 'x-forwarded-for': '1.1.1.1' }
    ),
    { params: Promise.resolve({ siteId: SITE_ID, blessingPageId: PUBLIC_PAGE_ID }) }
  );

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.blessing.isNonMemberContribution, true);
  assert.equal(data.blessing.visibleToPublic, true);
  assert.equal(data.blessing.authorName, 'A Visitor');
  assert.equal(data.blessing.guestEmail, 'visitor@example.com');
  assert.ok(notified);
  assert.equal(notified.eventType, 'guest_blessing');

  console.log('non-member can post to public page test passed');
}

async function testNonMemberCannotPostToPrivatePage() {
  __resetRateLimitStore();
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockBlessingRepository(new BlessingRepository(fakeDb));
  __setMockNotify(async () => {});

  const res = await POST(
    makeRequest(
      { authorName: 'A Visitor', content: 'Trying to post to a private page' },
      { 'x-forwarded-for': '2.2.2.2' }
    ),
    { params: Promise.resolve({ siteId: SITE_ID, blessingPageId: PRIVATE_PAGE_ID }) }
  );

  assert.ok(res.status === 403 || res.status === 404);

  console.log('non-member cannot post to private page test passed');
}

async function testVisibleToPublicIsForcedRegardlessOfInput() {
  __resetRateLimitStore();
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockBlessingRepository(new BlessingRepository(fakeDb));
  __setMockNotify(async () => {});

  const res = await POST(
    // Attempt to submit visibleToPublic:false — must be ignored/forced true.
    makeRequest(
      { authorName: 'Sneaky', content: 'Trying to stay private', visibleToPublic: false },
      { 'x-forwarded-for': '3.3.3.3' }
    ),
    { params: Promise.resolve({ siteId: SITE_ID, blessingPageId: PUBLIC_PAGE_ID }) }
  );
  const data = await res.json();
  assert.equal(data.blessing.visibleToPublic, true);

  console.log('visibleToPublic is forced true for non-member submissions test passed');
}

async function testHoneypotSilentlyDropsSubmission() {
  __resetRateLimitStore();
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const blessingRepo = new BlessingRepository(fakeDb);
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockBlessingRepository(blessingRepo);
  let notifyCalled = false;
  __setMockNotify(async () => { notifyCalled = true; });

  const res = await POST(
    makeRequest(
      { authorName: 'Bot', content: 'spam', honeyputValue: 'filled-by-bot' },
      { 'x-forwarded-for': '4.4.4.4' }
    ),
    { params: Promise.resolve({ siteId: SITE_ID, blessingPageId: PUBLIC_PAGE_ID }) }
  );

  assert.equal(res.status, 201);
  const stored = await blessingRepo.listByBlessingPage(PUBLIC_PAGE_ID);
  assert.equal(stored.length, 0);
  assert.equal(notifyCalled, false);

  console.log('honeypot-filled submission is silently dropped test passed');
}

async function testRateLimitRejectsNPlus1thSubmissionFromSameSource() {
  __resetRateLimitStore();
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  __setMockBlessingPageRepository(makeFakeBlessingPageRepo());
  __setMockBlessingRepository(new BlessingRepository(fakeDb));
  __setMockNotify(async () => {});

  const ip = '9.9.9.9';
  let lastStatus = 0;
  // The per-page limit is 3 within the window; the 4th from the same IP
  // against the same page must be rejected.
  for (let i = 0; i < 4; i++) {
    const res = await POST(
      makeRequest({ authorName: `Visitor ${i}`, content: `Memory ${i}` }, { 'x-forwarded-for': ip }),
      { params: Promise.resolve({ siteId: SITE_ID, blessingPageId: PUBLIC_PAGE_ID }) }
    );
    lastStatus = res.status;
    if (i < 3) {
      assert.equal(res.status, 201);
    }
  }
  assert.equal(lastStatus, 429);

  console.log('rate limit rejects (N+1)th submission from same source test passed');
}

async function run() {
  const mod = await import('../src/app/api/site/[siteId]/blessing-pages/[blessingPageId]/blessings/public/route');
  POST = mod.POST;
  __setMockBlessingPageRepository = mod.__setMockBlessingPageRepository;
  __setMockBlessingRepository = mod.__setMockBlessingRepository;
  __setMockNotify = mod.__setMockNotify;

  await testNonMemberCanPostToPublicPage();
  await testNonMemberCannotPostToPrivatePage();
  await testVisibleToPublicIsForcedRegardlessOfInput();
  await testHoneypotSilentlyDropsSubmission();
  await testRateLimitRejectsNPlus1thSubmissionFromSameSource();
}

run();
