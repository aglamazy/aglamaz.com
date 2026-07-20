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

async function testWindowSpansRollingRangeNotFixedMonth() {
  // Window: 2026-07-20 through 2026-08-20 (this week + ~1 month out), crossing a
  // calendar-month boundary. Events outside the window but inside one of the touched
  // calendar months (July 10, August 25) must be excluded; events inside the window
  // (July 25, August 15) must be included - proving the compile is date-range bound,
  // not "everything in the touched calendar months".
  const startDate = new Date(2026, 6, 20); // Jul 20, 2026
  const endDate = new Date(2026, 7, 20); // Aug 20, 2026

  const eventsByMonth: Record<string, any[]> = {
    '6-2026': [
      { id: 'before-window', siteId: 'site1', type: 'birthday', name: 'Too Early', month: 6, day: 10, year: 2020, isAnnual: true },
      { id: 'in-window-july', siteId: 'site1', type: 'birthday', name: 'Late July', month: 6, day: 25, year: 2020, isAnnual: true },
    ],
    '7-2026': [
      { id: 'in-window-august', siteId: 'site1', type: 'death', name: 'Mid August', month: 7, day: 15, year: 2020, isAnnual: true },
      { id: 'after-window', siteId: 'site1', type: 'birthday', name: 'Too Late', month: 7, day: 25, year: 2020, isAnnual: true },
    ],
  };

  const capturedMonthYearPairs: Array<{ month: number; year: number }> = [];
  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number) => {
      capturedMonthYearPairs.push({ month, year });
      return eventsByMonth[`${month}-${year}`] ?? [];
    },
  };
  const galleryPhotoRepository: any = { listBySite: async () => [] };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository);
  const digest = await service.compileDigestWindow('site1', startDate, endDate);

  assert.deepEqual(capturedMonthYearPairs, [{ month: 6, year: 2026 }, { month: 7, year: 2026 }], 'must query every calendar month the range touches');
  assert.deepEqual(digest.events.map((e) => e.id), ['in-window-july', 'in-window-august'], 'only events inside the date range must survive, ordered by occurrence');
  assert.equal(digest.startDate, startDate);
  assert.equal(digest.endDate, endDate);

  const julyEvent = digest.events.find((e) => e.id === 'in-window-july')!;
  assert.equal(julyEvent.occurrenceDate.getFullYear(), 2026, 'occurrenceDate must use the queried year, not the stored (creation) year');
  assert.equal(julyEvent.occurrenceDate.getMonth(), 6);
  assert.equal(julyEvent.occurrenceDate.getDate(), 25);

  console.log('window spans rolling range, not fixed calendar month: PASSED');
}

async function testWindowWithinSingleWeekQueriesOneMonth() {
  // A short window fully inside one calendar month must query that month only once,
  // not silently widen to a full month-in-review.
  const startDate = new Date(2026, 6, 20);
  const endDate = new Date(2026, 6, 27);

  const capturedMonthYearPairs: Array<{ month: number; year: number }> = [];
  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number) => {
      capturedMonthYearPairs.push({ month, year });
      return [];
    },
  };
  const galleryPhotoRepository: any = { listBySite: async () => [] };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository);
  await service.compileDigestWindow('site1', startDate, endDate);

  assert.deepEqual(capturedMonthYearPairs, [{ month: 6, year: 2026 }]);
  console.log('window within a single month queries exactly one month: PASSED');
}

async function run() {
  await testCompilesEventsAndPhotos();
  await testEmptyWhenNothingInRange();
  await testPassesLocaleAndCustomLimit();
  await testWindowSpansRollingRangeNotFixedMonth();
  await testWindowWithinSingleWeekQueriesOneMonth();
}

run();
