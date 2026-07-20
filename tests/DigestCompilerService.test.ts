import assert from 'node:assert/strict';
import { DigestCompilerService } from '../src/services/DigestCompilerService';
import type { DigestWindowPayload } from '../src/services/DigestCompilerService';

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

async function testRollingWindowSpanIsNotFixedMonth() {
  // from = July 20, 2026; to = August 17, 2026 (28 days forward)
  const from = new Date(Date.UTC(2026, 6, 20));  // July 20
  const to   = new Date(Date.UTC(2026, 7, 17));  // Aug  17

  const eventsJuly: any[] = [
    // in range: July 25
    { id: 'e-in',  siteId: 's1', month: 6, day: 25, year: 2020, isAnnual: true },
    // out of range: July 10 (before window start)
    { id: 'e-pre', siteId: 's1', month: 6, day: 10, year: 2020, isAnnual: true },
  ];
  const eventsAug: any[] = [
    // in range: Aug 5
    { id: 'e-aug-in',  siteId: 's1', month: 7, day: 5,  year: 2020, isAnnual: true },
    // out of range: Aug 20 (after window end)
    { id: 'e-aug-out', siteId: 's1', month: 7, day: 20, year: 2020, isAnnual: true },
    // non-annual event whose own year doesn't match queriedYear — still filtered by date
    { id: 'e-non-ann', siteId: 's1', month: 7, day: 10, year: 2026, isAnnual: false },
  ];

  const calls: Array<{ month: number; year: number }> = [];
  const anniversaryRepository: any = {
    getEventsForMonth: async (siteId: string, month: number, year: number) => {
      calls.push({ month, year });
      if (month === 6) return eventsJuly;
      if (month === 7) return eventsAug;
      return [];
    },
  };
  const galleryPhotoRepository: any = { listBySite: async () => [] };

  const service = new DigestCompilerService(anniversaryRepository, galleryPhotoRepository);
  const digest: DigestWindowPayload = await service.compileRollingWindowDigest('s1', from, to);

  // Should have queried both months covering the window
  assert.equal(calls.length, 2);
  assert.ok(calls.some(c => c.month === 6 && c.year === 2026), 'should query July 2026');
  assert.ok(calls.some(c => c.month === 7 && c.year === 2026), 'should query August 2026');

  // Window is 28 days, not a fixed calendar month
  const windowDays = (digest.to.getTime() - digest.from.getTime()) / (1000 * 60 * 60 * 24);
  assert.ok(windowDays >= 7 && windowDays <= 31, `window should be 7–31 days, got ${windowDays}`);

  // July 25 is in range
  assert.ok(digest.events.some(e => e.id === 'e-in'), 'July 25 should be included');
  // July 10 is before window start
  assert.ok(!digest.events.some(e => e.id === 'e-pre'), 'July 10 should be excluded (before window)');
  // Aug 5 is in range
  assert.ok(digest.events.some(e => e.id === 'e-aug-in'), 'Aug 5 should be included');
  // Aug 20 is after window end
  assert.ok(!digest.events.some(e => e.id === 'e-aug-out'), 'Aug 20 should be excluded (after window)');
  // Aug 10 non-annual, in range
  assert.ok(digest.events.some(e => e.id === 'e-non-ann'), 'Aug 10 non-annual should be included');

  // Deduplication: calling with overlapping months must not produce duplicates
  assert.equal(new Set(digest.events.map(e => e.id)).size, digest.events.length, 'no duplicate events');

  console.log('rolling window span is not fixed month test passed');
}

async function run() {
  await testCompilesEventsAndPhotos();
  await testEmptyWhenNothingInRange();
  await testPassesLocaleAndCustomLimit();
  await testRollingWindowSpanIsNotFixedMonth();
}

run();
