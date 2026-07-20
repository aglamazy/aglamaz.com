/**
 * Tests for DigestTemplateService.buildMonthlyDigestEmail
 *
 * Verifies: img thumbnails for events+photos, anchor links to calendar/photos pages,
 * uniform row styling regardless of event type (no special memorial treatment).
 */

import assert from 'node:assert/strict';
import { DigestTemplateService } from '../src/services/DigestTemplateService';
import type { DigestPayload } from '../src/services/DigestCompilerService';

function makeTimestamp(d: Date) {
  return { toDate: () => d };
}

const SITE_URL = 'https://site.famcircle.app';

const FIXTURE_DIGEST: DigestPayload = {
  siteId: 'site1',
  month: 6,
  year: 2026,
  events: [
    {
      id: 'e-bday',
      siteId: 'site1',
      ownerId: 'u1',
      name: 'Alice Birthday',
      type: 'birthday',
      date: makeTimestamp(new Date(2026, 6, 5)),
      month: 6,
      day: 5,
      year: 2026,
      isAnnual: true,
      imageUrl: 'https://cdn.example.com/alice.jpg',
      createdAt: makeTimestamp(new Date(2020, 0, 1)),
    },
    {
      id: 'e-death',
      siteId: 'site1',
      ownerId: 'u1',
      name: 'Grandpa Memorial',
      type: 'death',
      date: makeTimestamp(new Date(2026, 6, 20)),
      month: 6,
      day: 20,
      year: 2026,
      isAnnual: true,
      // no imageUrl — should use placeholder
      createdAt: makeTimestamp(new Date(2020, 0, 1)),
    },
  ],
  photos: [
    {
      id: 'p1',
      siteId: 'site1',
      createdBy: 'u1',
      createdAt: makeTimestamp(new Date(2026, 6, 1)) as any,
      date: makeTimestamp(new Date(2026, 6, 1)) as any,
      imagesWithDimensions: [{ url: 'https://cdn.example.com/photo1.jpg', width: 800, height: 600 }],
      deletedAt: null,
      description: 'Beach gathering',
    } as any,
    {
      id: 'p2',
      siteId: 'site1',
      createdBy: 'u1',
      createdAt: makeTimestamp(new Date(2026, 6, 10)) as any,
      date: makeTimestamp(new Date(2026, 6, 10)) as any,
      imagesWithDimensions: [],   // no images — should use placeholder
      deletedAt: null,
    } as any,
  ],
};

async function testImgTagsPresent() {
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE_DIGEST, {
    locale: 'en',
    siteName: 'Test Family',
    siteUrl: SITE_URL,
  });

  // Event with imageUrl should produce an <img> tag
  assert.ok(
    html.includes('https://cdn.example.com/alice.jpg'),
    'event imageUrl should appear in HTML',
  );
  assert.ok(
    html.includes('<img') && html.includes('alice.jpg'),
    'event imageUrl should be in an <img> tag',
  );

  // Photo with imagesWithDimensions[0].url should produce an <img> tag
  assert.ok(
    html.includes('https://cdn.example.com/photo1.jpg'),
    'photo thumbnail URL should appear in HTML',
  );
  assert.ok(
    html.includes('<img') && html.includes('photo1.jpg'),
    'photo thumbnail should be in an <img> tag',
  );

  // Event without imageUrl should use placeholder div (no broken img)
  // We check that there's no img tag pointing at an undefined/empty src
  const imgSrcMatches = [...html.matchAll(/src="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(
    imgSrcMatches.every((src) => src && src.length > 0),
    'no img tags with empty src (broken image)',
  );

  console.log('img tags present: PASSED');
}

async function testAnchorLinksWrappingRows() {
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE_DIGEST, {
    locale: 'en',
    siteName: 'Test Family',
    siteUrl: SITE_URL,
  });

  // Events should link to /app/calendar
  assert.ok(
    html.includes(`${SITE_URL}/app/calendar`),
    'event rows should have anchor links to the calendar page',
  );

  // Photos should link to /app/photos
  assert.ok(
    html.includes(`${SITE_URL}/app/photos`),
    'photo rows should have anchor links to the photos page',
  );

  // Anchor tags must be present
  assert.ok(html.includes('<a ') || html.includes('<a\n'), 'HTML should contain anchor tags');

  console.log('anchor links wrapping rows: PASSED');
}

async function testNoSpecialMemorialStyling() {
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE_DIGEST, {
    locale: 'en',
    siteName: 'Test Family',
    siteUrl: SITE_URL,
  });

  // The "note" yellow highlight box CSS class should NOT appear for memorial events
  // Check that both events produce rows with the same table structure
  const birthdayEventCount = (html.match(/Alice Birthday/g) || []).length;
  const deathEventCount = (html.match(/Grandpa Memorial/g) || []).length;
  assert.ok(birthdayEventCount > 0, 'birthday event should appear in HTML');
  assert.ok(deathEventCount > 0, 'death event should appear in HTML');

  // The yellow "note" box should not be present (class="note" is the warning treatment)
  // It could appear for both or neither — the requirement is that death events are not
  // singled out differently from birthday events. We verify by checking no note class
  // appears around the death event content.
  const noteClassMatches = html.match(/class="note"/g);
  assert.ok(!noteClassMatches || noteClassMatches.length === 0, 'no note-box styling should appear');

  console.log('no special memorial styling: PASSED');
}

async function testNoLinksWhenNoSiteUrl() {
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE_DIGEST, {
    locale: 'en',
    siteName: 'Test Family',
    // no siteUrl
  });

  // Should still produce img tags for events with imageUrl
  assert.ok(html.includes('alice.jpg'), 'event image should still render without siteUrl');

  // Should NOT produce links to /app/calendar or /app/photos
  assert.ok(!html.includes('/app/calendar'), 'no calendar links when siteUrl omitted');
  assert.ok(!html.includes('/app/photos'), 'no photos links when siteUrl omitted');

  console.log('no links when siteUrl omitted: PASSED');
}

async function testPlaceholderForMissingImages() {
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE_DIGEST, {
    locale: 'en',
    siteName: 'Test Family',
    siteUrl: SITE_URL,
  });

  // Grandpa Memorial has no imageUrl — should render a placeholder div
  // The placeholder uses a background colour div, so no <img> for that event
  // We cannot distinguish which <img> belongs to which event easily,
  // but we can verify the placeholder div is present
  assert.ok(
    html.includes('background:#eef5f0'),
    'placeholder div with background color should appear for missing images',
  );

  console.log('placeholder for missing images: PASSED');
}

async function run() {
  await testImgTagsPresent();
  await testAnchorLinksWrappingRows();
  await testNoSpecialMemorialStyling();
  await testNoLinksWhenNoSiteUrl();
  await testPlaceholderForMissingImages();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
