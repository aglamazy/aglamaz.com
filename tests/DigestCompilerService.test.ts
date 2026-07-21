import assert from 'node:assert/strict';
import { DigestCompilerService } from '../src/services/DigestCompilerService';

async function testCompilesEventsAndPhotos() {
  const mockEvents = [
    { id: 'e1', siteId: 'site1', type: 'birthday', name: 'Alice', month: 6, day: 5, year: 2026 },
  ];
  const mockPhotos = [
    { id: 'p1', siteId: 'site1', imagesWithDimensions: [{ url: 'https://x/1.jpg', width: 10, height: 10 }] },
  ];

  let capturedEventsArgs: any;
  let capturedPhotosArgs: any;

  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number, locale?: string) => {
      capturedEventsArgs = { siteId, month, year, locale };
      return mockEvents;
    },
  };
  const galleryPhotoRepository: any = {
    listBySite: async (siteId: string, locale?: string, options?: any) => {
      capturedPhotosArgs = { siteId, locale, options };
      return mockPhotos;
    },
  };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository);
  const digest = await service.compileDigest('site1', 6, 2026);

  assert.deepEqual(digest.events, mockEvents);
  assert.deepEqual(digest.photos, mockPhotos);
  assert.equal(digest.siteId, 'site1');
  assert.equal(digest.month, 6);
  assert.equal(digest.year, 2026);
  assert.deepEqual(capturedEventsArgs, { siteId: 'site1', month: 6, year: 2026, locale: undefined });
  assert.equal(capturedPhotosArgs.siteId, 'site1');
  assert.equal(capturedPhotosArgs.options.limit, 12);
  console.log('compiles events and photos test passed');
}

async function testEmptyWhenNothingInRange() {
  const anniversaryRepository: any = { getEventsForMonth: async () => [] };
  const galleryPhotoRepository: any = { listBySite: async () => [] };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository);
  const digest = await service.compileDigest('site-empty', 1, 2026);

  assert.deepEqual(digest.events, []);
  assert.deepEqual(digest.photos, []);
  console.log('empty range test passed');
}

async function testPassesLocaleAndCustomLimit() {
  let capturedEventsArgs: any;
  let capturedPhotosArgs: any;
  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number, locale?: string) => {
      capturedEventsArgs = { siteId, month, year, locale };
      return [];
    },
  };
  const galleryPhotoRepository: any = {
    listBySite: async (siteId: string, locale?: string, options?: any) => {
      capturedPhotosArgs = { siteId, locale, options };
      return [];
    },
  };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository);
  await service.compileDigest('site1', 3, 2026, { locale: 'he', recentPhotosLimit: 5 });

  assert.equal(capturedEventsArgs.locale, 'he');
  assert.equal(capturedPhotosArgs.locale, 'he');
  assert.equal(capturedPhotosArgs.options.limit, 5);
  console.log('locale and custom limit test passed');
}

async function testWeeklyDigestUsesRollingWindowNotCalendarMonth() {
  // Weekly cadence: 1 week back (past) + 1 month forward (coming) from "today"
  // (2026-07-21), NOT calendar-month-aligned - per Agla's 2026-07-21 request ("maybe
  // just 1w back, and 1m forward, not exact month boundary"). Deliberately crosses a
  // calendar-month boundary in the coming range to prove it's rolling, not fixed-month.
  const referenceDate = new Date(2026, 6, 21); // July 21, 2026

  const eventsByMonth: Record<string, any[]> = {
    '6-2026': [
      { id: 'before-past-window', siteId: 'site1', type: 'birthday', name: 'Too Early', month: 6, day: 10, year: 1990, isAnnual: true },
      { id: 'in-past-window', siteId: 'site1', type: 'birthday', name: 'Late July', month: 6, day: 16, year: 1990, isAnnual: true },
    ],
    '7-2026': [
      { id: 'in-coming-window-august', siteId: 'site1', type: 'death', name: 'Early August', month: 7, day: 5, year: 1990, isAnnual: true },
      { id: 'after-coming-window', siteId: 'site1', type: 'wedding', name: 'Too Late', month: 7, day: 25, year: 2015, isAnnual: true },
    ],
  };

  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number) => eventsByMonth[`${month}-${year}`] ?? [],
  };
  const galleryPhotoRepository: any = { listBySite: async () => [], listByAnniversary: async () => [] };
  const occurrenceRepository: any = { listByEvent: async () => [] };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository, occurrenceRepository);
  const digest = await service.compileWeeklyDigest('site1', referenceDate);

  const pastIds = digest.pastEvents.map((e: any) => e.event.id);
  const comingIds = digest.comingEvents.map((e: any) => e.event.id);
  assert.deepEqual(pastIds, ['in-past-window'], 'past range must be exactly 7 days back, not a full calendar month');
  assert.deepEqual(comingIds, ['in-coming-window-august'], 'coming range must reach 1 month forward, crossing the month boundary');

  const expectedPastStart = new Date(referenceDate);
  expectedPastStart.setDate(expectedPastStart.getDate() - 7);
  const expectedComingEnd = new Date(referenceDate);
  expectedComingEnd.setMonth(expectedComingEnd.getMonth() + 1);
  assert.equal(digest.pastRange.startDate.getTime(), expectedPastStart.getTime());
  assert.equal(digest.pastRange.endDate.getTime(), referenceDate.getTime());
  assert.equal(digest.comingRange.startDate.getTime(), referenceDate.getTime());
  assert.equal(digest.comingRange.endDate.getTime(), expectedComingEnd.getTime());

  console.log('weekly digest uses a rolling 1-week-back/1-month-forward window, not a calendar month: PASSED');
}

async function testCollagePhotosAreYearFilteredWithMainImageFallback() {
  // A wedding anniversary in August: real photos exist from last year's occurrence
  // (2025), but this year's (2026) hasn't happened yet - the collage must NOT show last
  // year's party as if it were "what's coming", it should fall back to just the event's
  // main picture (Agla, 2026-07-21: "This is from last year - keep just the main image").
  const referenceDate = new Date(2026, 6, 21); // July 21, 2026
  const comingEvent = {
    id: 'wedding-1',
    siteId: 'site1',
    type: 'wedding',
    name: 'Liat & Matan',
    month: 7,
    day: 6,
    year: 2015, // original entry year - compiler remaps to 2026 for the "coming" slot
    isAnnual: true,
    imageUrl: 'https://x/cover.jpg',
  };

  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number) =>
      month === 7 ? [comingEvent] : [], // only present in August (month index 7)
  };
  const galleryPhotoRepository: any = {
    listBySite: async () => [],
    listByAnniversary: async () => [],
  };
  const occurrenceRepository: any = {
    listByEvent: async () => [
      {
        id: 'occ-2025',
        eventId: 'wedding-1',
        date: { toDate: () => new Date(2025, 7, 6) }, // last year's real party photos
        imagesWithDimensions: [{ url: 'https://x/last-year-1.jpg' }, { url: 'https://x/last-year-2.jpg' }],
      },
    ],
  };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository, occurrenceRepository);
  const digest = await service.compileMonthlyDigest('site1', referenceDate);

  const entry = digest.comingEvents.find((e: any) => e.event.id === 'wedding-1');
  assert.ok(entry, 'the wedding event must be in the coming list');
  assert.deepEqual(entry.photoUrls, ['https://x/cover.jpg'], 'must fall back to just the main image, not last year\'s photos');
  console.log('collage photos are year-filtered, falling back to the main image: PASSED');
}

async function testCollageIncludesMatchingYearOccurrencePhotos() {
  // Same shape, but the occurrence IS from the target year - its real photos (plus the
  // main image) must be included.
  const referenceDate = new Date(2026, 6, 21);
  const comingEvent = {
    id: 'party-1',
    siteId: 'site1',
    type: 'other',
    name: 'Party!',
    month: 7,
    day: 18,
    year: 2026,
    isAnnual: false,
    imageUrl: 'https://x/cover.jpg',
  };

  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number) => (month === 6 ? [comingEvent] : []),
  };
  const galleryPhotoRepository: any = { listBySite: async () => [], listByAnniversary: async () => [] };
  const occurrenceRepository: any = {
    listByEvent: async () => [
      {
        id: 'occ-2026',
        eventId: 'party-1',
        date: { toDate: () => new Date(2026, 6, 18) },
        imagesWithDimensions: [{ url: 'https://x/party-1.jpg' }, { url: 'https://x/party-2.jpg' }],
      },
    ],
  };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository, occurrenceRepository);
  const digest = await service.compileMonthlyDigest('site1', referenceDate);

  const entry = digest.comingEvents.find((e: any) => e.event.id === 'party-1');
  assert.ok(entry, 'the party event must be in the coming list');
  assert.deepEqual(
    entry.photoUrls,
    ['https://x/cover.jpg', 'https://x/party-1.jpg', 'https://x/party-2.jpg'],
    'main image + this year\'s real occurrence photos must all be included',
  );
  console.log('collage includes matching-year occurrence photos alongside the main image: PASSED');
}

async function run() {
  await testCompilesEventsAndPhotos();
  await testEmptyWhenNothingInRange();
  await testPassesLocaleAndCustomLimit();
  await testWeeklyDigestUsesRollingWindowNotCalendarMonth();
  await testCollagePhotosAreYearFilteredWithMainImageFallback();
  await testCollageIncludesMatchingYearOccurrencePhotos();
}

run();
