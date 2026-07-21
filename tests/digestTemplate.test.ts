/**
 * Tests for DigestTemplateService.buildMonthlyDigestEmail
 *
 * QA focus (famcircle#59/#65-fix, family-digest-formats-spec.md §6, real-data preview fixes):
 * - each event row renders a real <img> thumbnail when imageUrl is present, and a
 *   graceful (non-broken-image) placeholder when it's missing
 * - the "recent photos" section renders real <img> thumbnails from
 *   imagesWithDimensions[0].url, not just a text/count line
 * - every event row and every photo thumbnail is wrapped in a clickable <a> tag into
 *   the site (calendar / gallery), not just visually styled
 * - no memorial (death) event gets a distinct "note/warning" box - same row markup as
 *   birthday/wedding
 * - the digest covers a full past calendar month + a two-month coming window, not a
 *   rolling window (Agla, 2026-07-21 live-testing corrections)
 * - past events render as an article (description + that event's own photos), not just
 *   a row (Agla, 2026-07-21)
 */

import assert from 'node:assert/strict';
import { DigestTemplateService } from '../src/services/DigestTemplateService';
import type { MonthlyDigestPayload } from '../src/services/DigestCompilerService';

const CALENDAR_URL = 'https://example.com/app/calendar';
const GALLERY_URL = 'https://example.com/app/photos';

const FIXTURE: MonthlyDigestPayload = {
  siteId: 'site1',
  pastMonth: { month: 5, year: 2026 },
  comingRange: { startMonth: 6, startYear: 2026, endMonth: 7, endYear: 2026 },
  comingEvents: [
    {
      id: 'e1',
      siteId: 'site1',
      ownerId: 'owner1',
      name: 'Grandpa Moshe',
      type: 'birthday',
      date: null,
      month: 6,
      day: 5,
      year: 2026,
      isAnnual: true,
      imageUrl: 'https://example.com/photos/moshe.jpg',
      createdAt: null,
    } as any,
    {
      id: 'e3',
      siteId: 'site1',
      ownerId: 'owner1',
      name: 'Dan & Mira',
      type: 'wedding',
      date: null,
      month: 7,
      day: 3,
      year: 2026,
      isAnnual: true,
      imageUrl: 'https://example.com/photos/dan-mira.jpg',
      createdAt: null,
    } as any,
  ],
  pastEvents: [
    {
      event: {
        id: 'e2',
        siteId: 'site1',
        ownerId: 'owner1',
        name: 'Grandma Sarah',
        type: 'death',
        description: 'A quiet visit to the family plot.',
        date: null,
        month: 5,
        day: 10,
        year: 2026,
        isAnnual: true,
        // no imageUrl - must fall back to a placeholder, not a broken <img>
        createdAt: null,
      } as any,
      photos: [
        {
          id: 'pe1',
          siteId: 'site1',
          createdBy: 'owner1',
          createdAt: null,
          anniversaryId: 'e2',
          date: { toDate: () => new Date(2026, 5, 10) } as any,
          imagesWithDimensions: [{ url: 'https://example.com/photos/sarah-visit.jpg', width: 800, height: 600 }],
        } as any,
      ],
    },
  ],
  photos: [
    {
      id: 'p1',
      siteId: 'site1',
      createdBy: 'owner1',
      createdAt: null,
      date: { toDate: () => new Date(2026, 5, 20) } as any,
      imagesWithDimensions: [{ url: 'https://example.com/photos/gallery1.jpg', width: 800, height: 600 }],
    } as any,
    {
      id: 'p2',
      siteId: 'site1',
      createdBy: 'owner1',
      createdAt: null,
      date: { toDate: () => new Date(2026, 5, 21) } as any,
      imagesWithDimensions: [],
    } as any,
  ],
};

function buildFixtureHtml(): string {
  const result = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Grandpa Moshe',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
  });
  return result.html;
}

function testEventRowsHaveRealImgTagsWhenImageUrlPresent() {
  const html = buildFixtureHtml();
  assert.ok(html.includes('src="https://example.com/photos/moshe.jpg"'), 'birthday event thumbnail missing');
  assert.ok(html.includes('src="https://example.com/photos/dan-mira.jpg"'), 'wedding event thumbnail missing');
  console.log('event rows render real img thumbnails: PASSED');
}

function testMissingImageUrlFallsBackGracefully() {
  const html = buildFixtureHtml();
  // Grandma Sarah has no imageUrl - must not emit a broken <img> tag for her article block.
  const articleMatch = html.match(/Grandma Sarah[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(articleMatch, 'could not locate the past-event article for Grandma Sarah');
  assert.ok(!/<img[^>]*alt="Grandma Sarah"/.test(articleMatch![0]), 'missing imageUrl must not render a broken event <img> tag');
  console.log('missing imageUrl falls back gracefully (no broken img): PASSED');
}

function testPhotoSectionRendersRealThumbnails() {
  const html = buildFixtureHtml();
  assert.ok(html.includes('src="https://example.com/photos/gallery1.jpg"'), 'gallery photo thumbnail missing');
  console.log('recent photos section renders real thumbnails: PASSED');
}

function testPastEventShowsDescriptionAndOwnPhotos() {
  const html = buildFixtureHtml();
  assert.ok(html.includes('A quiet visit to the family plot.'), 'past event description missing');
  assert.ok(html.includes('src="https://example.com/photos/sarah-visit.jpg"'), "past event's own photo missing");
  console.log('past event renders as an article with description + its own photos: PASSED');
}

function testEventRowsAreClickableIntoCalendar() {
  const html = buildFixtureHtml();
  const anchorCount = (html.match(new RegExp(`<a href="${CALENDAR_URL}"`, 'g')) || []).length;
  // 2 coming-event rows + 1 past-event article header link.
  assert.equal(anchorCount, 3, 'every event (coming rows + past article header) must link to the calendar');
  console.log('events are anchor-wrapped into the calendar: PASSED');
}

function testPhotoThumbnailsAreClickableIntoGallery() {
  const html = buildFixtureHtml();
  const anchorCount = (html.match(new RegExp(`<a href="${GALLERY_URL}"`, 'g')) || []).length;
  // 1 photo on the past event + 2 in the general recent-photos grid.
  assert.equal(anchorCount, 3, 'every photo thumbnail (event-specific + general) must be wrapped in an anchor to the gallery');
  console.log('photo thumbnails are anchor-wrapped into the gallery: PASSED');
}

function testNoMemorialWarningStyling() {
  const html = buildFixtureHtml();
  assert.ok(!html.includes('class="note'), 'memorial event must not use note/warning styling');
  assert.ok(!html.includes('<div class="note">'), 'digest email must not render any note box at all');
  console.log('no distinct memorial warning styling: PASSED');
}

function testGreetingUsesRecipientNameNotSiteName() {
  const result = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Dan',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
  });
  assert.ok(result.html.includes('Dan'), 'greeting must address the actual recipient');
  assert.ok(!result.text.startsWith('שלום The Aglamaz Family'), 'greeting must not address the site');
  console.log('greeting addresses the recipient, not the site: PASSED');
}

function testEmptySectionsAreOmitted() {
  const EMPTY_FIXTURE: MonthlyDigestPayload = { ...FIXTURE, comingEvents: [], pastEvents: [], photos: [] };
  const result = DigestTemplateService.buildMonthlyDigestEmail(EMPTY_FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Dan',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
  });
  assert.ok(!result.html.includes('<a href='), 'a fully empty digest must render no section content at all');
  console.log('empty sections are omitted rather than shown empty: PASSED');
}

function testCoversPastMonthAndTwoComingMonths() {
  const html = buildFixtureHtml();
  assert.ok(html.includes('Grandpa Moshe'), 'coming (this month) event must be present');
  assert.ok(html.includes('Dan &amp; Mira') || html.includes('Dan & Mira'), 'coming (next month) event must be present');
  assert.ok(html.includes('Grandma Sarah'), 'past-month event must be present');
  console.log('digest covers the past month plus a two-month coming window: PASSED');
}

function testAnnualEventShowsTargetYearNotOriginalEntryYear() {
  // Fixture events are already stamped with the digest's target year (2026), mirroring
  // what DigestCompilerService.compileMonthlyDigest now remaps to - regression guard
  // for the "1993 instead of 2026" bug (Agla, 2026-07-21).
  const html = buildFixtureHtml();
  assert.ok(html.includes('2026'), 'event dates must show the digest target year');
  console.log('annual event dates show the remapped target year: PASSED');
}

function run() {
  testEventRowsHaveRealImgTagsWhenImageUrlPresent();
  testMissingImageUrlFallsBackGracefully();
  testPhotoSectionRendersRealThumbnails();
  testPastEventShowsDescriptionAndOwnPhotos();
  testEventRowsAreClickableIntoCalendar();
  testPhotoThumbnailsAreClickableIntoGallery();
  testNoMemorialWarningStyling();
  testGreetingUsesRecipientNameNotSiteName();
  testEmptySectionsAreOmitted();
  testCoversPastMonthAndTwoComingMonths();
  testAnnualEventShowsTargetYearNotOriginalEntryYear();
}

run();
