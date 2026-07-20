/**
 * Tests for DigestTemplateService.buildMonthlyDigestEmail
 *
 * QA focus (famcircle#59, family-digest-formats-spec.md §6, real-data preview fixes):
 * - each event row renders a real <img> thumbnail when imageUrl is present, and a
 *   graceful (non-broken-image) placeholder when it's missing
 * - the "recent photos" section renders real <img> thumbnails from
 *   imagesWithDimensions[0].url, not just a text/count line
 * - every event row and every photo thumbnail is wrapped in a clickable <a> tag into
 *   the site (calendar / gallery), not just visually styled
 * - no memorial (death) event gets a distinct "note/warning" box - same row markup as
 *   birthday/wedding
 */

import assert from 'node:assert/strict';
import { DigestTemplateService } from '../src/services/DigestTemplateService';
import type { DigestPayload } from '../src/services/DigestCompilerService';

const CALENDAR_URL = 'https://example.com/app/calendar';
const GALLERY_URL = 'https://example.com/app/photos';

const FIXTURE: DigestPayload = {
  siteId: 'site1',
  month: 6,
  year: 2026,
  events: [
    {
      id: 'e1',
      siteId: 'site1',
      ownerId: 'owner1',
      name: 'Grandpa Moshe',
      type: 'birthday',
      date: null,
      month: 6,
      day: 5,
      year: 1990,
      isAnnual: true,
      imageUrl: 'https://example.com/photos/moshe.jpg',
      createdAt: null,
    } as any,
    {
      id: 'e2',
      siteId: 'site1',
      ownerId: 'owner1',
      name: 'Grandma Sarah',
      type: 'death',
      date: null,
      month: 6,
      day: 10,
      year: 2020,
      isAnnual: true,
      // no imageUrl - must fall back to a placeholder, not a broken <img>
      createdAt: null,
    } as any,
    {
      id: 'e3',
      siteId: 'site1',
      ownerId: 'owner1',
      name: 'Dan & Mira',
      type: 'wedding',
      date: null,
      month: 6,
      day: 15,
      year: 2015,
      isAnnual: true,
      imageUrl: 'https://example.com/photos/dan-mira.jpg',
      createdAt: null,
    } as any,
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
  // Grandma Sarah has no imageUrl - must not emit a broken <img> tag for her row.
  const deathRowMatch = html.match(/<a[^>]*>(?:(?!<\/a>).)*Grandma Sarah(?:(?!<\/a>).)*<\/a>/s);
  assert.ok(deathRowMatch, 'could not locate the death-event row anchor');
  assert.ok(!deathRowMatch![0].includes('<img'), 'missing imageUrl must not render a broken <img> tag');
  console.log('missing imageUrl falls back gracefully (no broken img): PASSED');
}

function testPhotoSectionRendersRealThumbnails() {
  const html = buildFixtureHtml();
  assert.ok(html.includes('src="https://example.com/photos/gallery1.jpg"'), 'gallery photo thumbnail missing');
  console.log('recent photos section renders real thumbnails: PASSED');
}

function testEventRowsAreClickableIntoCalendar() {
  const html = buildFixtureHtml();
  const anchorCount = (html.match(new RegExp(`<a href="${CALENDAR_URL}"`, 'g')) || []).length;
  assert.equal(anchorCount, FIXTURE.events.length, 'every event row must be wrapped in an anchor to the calendar');
  console.log('event rows are anchor-wrapped into the calendar: PASSED');
}

function testPhotoThumbnailsAreClickableIntoGallery() {
  const html = buildFixtureHtml();
  const anchorCount = (html.match(new RegExp(`<a href="${GALLERY_URL}"`, 'g')) || []).length;
  assert.equal(anchorCount, FIXTURE.photos.length, 'every photo thumbnail must be wrapped in an anchor to the gallery');
  console.log('photo thumbnails are anchor-wrapped into the gallery: PASSED');
}

function testNoMemorialWarningStyling() {
  const html = buildFixtureHtml();
  // The death-type row must not use the yellow "note" box class the template reserves for warnings.
  const deathRowMatch = html.match(/<a[^>]*>(?:(?!<\/a>).)*Grandma Sarah(?:(?!<\/a>).)*<\/a>/s);
  assert.ok(deathRowMatch, 'could not locate the death-event row anchor');
  assert.ok(!deathRowMatch![0].includes('class="note'), 'memorial event must not use note/warning styling');
  assert.ok(!html.includes('<div class="note">'), 'digest email must not render any note box at all');
  console.log('no distinct memorial warning styling: PASSED');
}

function run() {
  testEventRowsHaveRealImgTagsWhenImageUrlPresent();
  testMissingImageUrlFallsBackGracefully();
  testPhotoSectionRendersRealThumbnails();
  testEventRowsAreClickableIntoCalendar();
  testPhotoThumbnailsAreClickableIntoGallery();
  testNoMemorialWarningStyling();
}

run();
