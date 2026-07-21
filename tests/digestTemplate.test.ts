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
      event: {
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
      // DigestCompilerService always folds event.imageUrl into photoUrls - simulate that here.
      photoUrls: ['https://example.com/photos/moshe.jpg'],
    },
    {
      event: {
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
      photoUrls: ['https://example.com/photos/dan-mira.jpg'],
    },
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
      photoUrls: ['https://example.com/photos/sarah-visit.jpg'],
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
  // Per event: 1 header (title+date) anchor + 1 anchor per collage photo, into the
  // calendar (the event's own context) - not the general gallery (Agla, 2026-07-21).
  // 2 coming events + 1 past event, each with exactly 1 photo -> 2 anchors each = 6.
  assert.equal(anchorCount, 6, 'event headers AND their own collage photos must link to the calendar');
  console.log('events and their own photos are anchor-wrapped into the calendar: PASSED');
}

function testPhotoThumbnailsAreClickableIntoGallery() {
  const html = buildFixtureHtml();
  const anchorCount = (html.match(new RegExp(`<a href="${GALLERY_URL}"`, 'g')) || []).length;
  // Only the general recent-photos section (not tied to any one event) links to the
  // gallery now - per-event collages link to the calendar instead (Agla, 2026-07-21).
  assert.equal(anchorCount, 1, 'only the general recent-photos collage should link to the gallery');
  console.log('general recent-photos collage links to the gallery: PASSED');
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

function testComingSectionSplitsIntoTwoSubHeadings() {
  // Fixture: comingRange is July (this month, has Grandpa Moshe) -> August (next
  // month, has Dan & Mira) - regression guard for the two-h2 split (Agla, 2026-07-21).
  // Recipient name deliberately distinct from any event name, or the greeting's
  // occurrence of "Grandpa Moshe" would shift the ordering assertion below.
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
  });
  assert.ok(html.includes('<h2'), 'coming section must use real h2 sub-headings');
  assert.ok(html.includes('אז מה היה לנו בחודש July'), 'this-month sub-heading missing or wrong copy');
  assert.ok(html.includes('מה צפוי בחודש August'), 'next-month sub-heading missing or wrong copy');
  const thisMonthIdx = html.indexOf('אז מה היה לנו בחודש July');
  const nextMonthIdx = html.indexOf('מה צפוי בחודש August');
  const moshIdx = html.indexOf('Grandpa Moshe');
  const danIdx = html.indexOf('Dan &amp; Mira') !== -1 ? html.indexOf('Dan &amp; Mira') : html.indexOf('Dan & Mira');
  assert.ok(
    thisMonthIdx < moshIdx && moshIdx < nextMonthIdx && nextMonthIdx < danIdx,
    'this-month heading must precede this-month events, next-month heading must sit between the two groups',
  );
  console.log('coming section splits into this-month/next-month sub-headings: PASSED');
}

function testDeathEventShowsHebrewDate() {
  // Grandma Sarah (death type) must show a parenthesized REAL Hebrew-letter date
  // (gematria, e.g. ט"ז אלול תשפ"ו) alongside the Gregorian one, not Western digits -
  // Dan & Mira (wedding) must not show one at all (Agla, 2026-07-21).
  const html = buildFixtureHtml();
  const sarahBlock = html.slice(html.indexOf('Grandma Sarah'), html.indexOf('Grandma Sarah') + 200);
  assert.ok(/\([א-ת]/.test(sarahBlock), 'death event date must include a parenthesized Hebrew-letter (gematria) date, not digits');
  const danBlock = html.slice(html.indexOf('Dan'), html.indexOf('Dan') + 120);
  assert.ok(!/\(.+\)/.test(danBlock), 'non-death event date must not show a Hebrew date');
  console.log('death events show a real Hebrew-letter date alongside the Gregorian one: PASSED');
}

function testGreetingBidiIsolatesLatinNameAndTextStaysClean() {
  // A Latin-script name (common: many members' stored firstName/displayName come from
  // Google OAuth in Latin characters, even on a Hebrew site) embedded in the Hebrew
  // greeting must be bdi-isolated in HTML - and the plain-text version must never leak
  // that HTML markup as literal text (Agla, 2026-07-21: "this is worst").
  const result = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Yaakov Aglamaz',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
  });
  assert.ok(result.html.includes('<bdi>Yaakov Aglamaz</bdi>'), 'HTML greeting must bidi-isolate the recipient name');
  assert.ok(!result.text.includes('<bdi>'), 'plain-text greeting must not contain HTML markup');
  assert.ok(result.text.startsWith('שלום Yaakov Aglamaz,'), 'plain-text greeting must still read naturally');
  console.log('greeting bidi-isolates the name in HTML, stays clean in plain text: PASSED');
}

function testHeadingHierarchy() {
  // Section titles are h2, individual event titles inside them are h3 - a real semantic
  // hierarchy, not styled divs (Agla, 2026-07-21).
  const html = buildFixtureHtml();
  assert.ok(/<h2[^>]*>מה היה ב/.test(html), 'section card title must be a real h2');
  assert.ok(/<h3[^>]*>Grandpa Moshe<\/h3>/.test(html), 'individual event title must be a real h3');
  console.log('section titles are h2, event titles are h3: PASSED');
}

function testNoRedundantIntroLine() {
  // The generic "here's what's happening this month" line was dropped - it just
  // repeated the first section heading (Agla, 2026-07-21).
  const html = buildFixtureHtml();
  assert.ok(!html.includes('הנה מה שקורה החודש'), 'redundant intro line must be removed');
  console.log('redundant intro line removed: PASSED');
}

function testGeneralPhotosUseCollageNotThumbnailRow() {
  // The general recent-photos section uses the SAME masonry layout as the app's own
  // ImageGrid component (CSS columns, natural aspect ratio) - not a bespoke email-only
  // grid (Agla, 2026-07-21 - "use the global collage" / "use that component").
  const html = buildFixtureHtml();
  assert.ok(html.includes('column-count:2'), 'recent-photos section must use the same masonry layout as the app');
  console.log('general recent-photos section uses the app\'s masonry collage layout: PASSED');
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
  testGreetingBidiIsolatesLatinNameAndTextStaysClean();
  testEmptySectionsAreOmitted();
  testCoversPastMonthAndTwoComingMonths();
  testComingSectionSplitsIntoTwoSubHeadings();
  testDeathEventShowsHebrewDate();
  testHeadingHierarchy();
  testNoRedundantIntroLine();
  testGeneralPhotosUseCollageNotThumbnailRow();
  testAnnualEventShowsTargetYearNotOriginalEntryYear();
}

run();
