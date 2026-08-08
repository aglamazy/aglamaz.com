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
import type { CadenceDigestPayload } from '../src/services/DigestCompilerService';

const CALENDAR_URL = 'https://example.com/app/calendar';
const GALLERY_URL = 'https://example.com/app/photos';
const MANAGE_URL = 'https://example.com/app/manage-preferences';
const TEST_READ_TOKEN = 'test-token';

const FIXTURE: CadenceDigestPayload = {
  siteId: 'site1',
  pastRange: { startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 30) },
  comingRange: { startDate: new Date(2026, 6, 1), endDate: new Date(2026, 7, 31) },
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
      blessingPageSlug: 'e1-2026',
      blessingPageIsPublic: false,
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
      blessingPageSlug: 'e3-2026',
      blessingPageIsPublic: false,
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
      blessingPageSlug: 'e2-standing',
      // No public memorial page for this fixture's baseline scenario - past events must
      // still link to the calendar rather than a broken/private memorial link (famcircle#81).
      blessingPageIsPublic: false,
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
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
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
  // Every /app/* link carries the recipient's read-only token as `?rt=` (famcircle#127) -
  // match the tokenized href, not a bare exact-match that predates that change.
  const anchorCount = (html.match(new RegExp(`<a href="${CALENDAR_URL}\\?rt=${TEST_READ_TOKEN}"`, 'g')) || []).length;
  // Per event: 1 header (title+date) anchor + 1 anchor per collage photo, into the
  // calendar (the event's own context) - not the general gallery (Agla, 2026-07-21).
  // 2 coming events + 1 past event, each with exactly 1 photo -> 2 anchors each = 6.
  assert.equal(anchorCount, 6, 'event headers AND their own collage photos must link to the calendar');
  console.log('events and their own photos are anchor-wrapped into the calendar: PASSED');
}

function testPhotoThumbnailsAreClickableIntoGallery() {
  const html = buildFixtureHtml();
  const anchorCount = (html.match(new RegExp(`<a href="${GALLERY_URL}\\?rt=${TEST_READ_TOKEN}"`, 'g')) || []).length;
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
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  assert.ok(result.html.includes('Dan'), 'greeting must address the actual recipient');
  assert.ok(!result.text.startsWith('שלום The Aglamaz Family'), 'greeting must not address the site');
  console.log('greeting addresses the recipient, not the site: PASSED');
}

function testEmptySectionsAreOmitted() {
  const EMPTY_FIXTURE: CadenceDigestPayload = { ...FIXTURE, comingEvents: [], pastEvents: [], photos: [] };
  const result = DigestTemplateService.buildMonthlyDigestEmail(EMPTY_FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Dan',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  // The footer's manage-preferences link (famcircle#128) is unconditional - it's not
  // digest-content, so it must still appear even when every section is empty. Strip it
  // before asserting the actual section content rendered nothing.
  const withoutFooterLink = result.html.replace(new RegExp(`<a href="${MANAGE_URL}[^"]*">[^<]*</a>`), '');
  assert.ok(!withoutFooterLink.includes('<a href='), 'a fully empty digest must render no section content at all');
  console.log('empty sections are omitted rather than shown empty: PASSED');
}

function testCoversPastMonthAndTwoComingMonths() {
  const html = buildFixtureHtml();
  assert.ok(html.includes('Grandpa Moshe'), 'coming (this month) event must be present');
  assert.ok(html.includes('Dan &amp; Mira') || html.includes('Dan & Mira'), 'coming (next month) event must be present');
  assert.ok(html.includes('Grandma Sarah'), 'past-month event must be present');
  console.log('digest covers the past month plus a two-month coming window: PASSED');
}

function testComingSectionSplitsByMonth() {
  // Fixture: comingRange is July (has Grandpa Moshe) -> August (has Dan & Mira) -
  // regression guard for the per-month h2 split, generalized off CadenceDigestPayload's
  // DateRange so both cadences share one implementation (Agla, 2026-07-21 DRY correction
  // - monthly's old "this month/next month" tense-specific copy was replaced with one
  // neutral "אירועים ב{month}" heading per month touched, valid for any window length).
  // Recipient name deliberately distinct from any event name, or the greeting's
  // occurrence of "Grandpa Moshe" would shift the ordering assertion below.
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  assert.ok(html.includes('<h2'), 'coming section must use real h2 sub-headings');
  assert.ok(html.includes('אירועים בJuly'), 'July sub-heading missing or wrong copy');
  assert.ok(html.includes('אירועים בAugust'), 'August sub-heading missing or wrong copy');
  const julyIdx = html.indexOf('אירועים בJuly');
  const augustIdx = html.indexOf('אירועים בAugust');
  const moshIdx = html.indexOf('Grandpa Moshe');
  const danIdx = html.indexOf('Dan &amp; Mira') !== -1 ? html.indexOf('Dan &amp; Mira') : html.indexOf('Dan & Mira');
  assert.ok(
    julyIdx < moshIdx && moshIdx < augustIdx && augustIdx < danIdx,
    'July heading must precede July events, August heading must sit between the two groups',
  );
  console.log('coming section splits into per-month sub-headings: PASSED');
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
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
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
  // Grandpa Moshe is a bare-name birthday event, so it gets the auto birthday label (see testBareNameBirthdayGetsAutoLabel).
  assert.ok(/<h3[^>]*>Grandpa Moshe's birthday<\/h3>/.test(html), 'individual event title must be a real h3');
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

function testBirthdayEventNameAutoLabel() {
  // A bare-name birthday event ("אורן אגלמז") should get "birthday" auto-added,
  // since the name alone doesn't convey the occasion - but an event whose name
  // already reads as a celebration title ("מסיבת לילה אגלמז!") is fine as-is
  // (Agla, 2026-07-22, with two real screenshots: bare name needed the label,
  // "מסיבת לילה אגלמז!" did not).
  const bareNameEvent: CadenceDigestPayload = {
    ...FIXTURE,
    comingEvents: [
      {
        event: { ...FIXTURE.comingEvents[0].event, id: 'bare', name: 'אורן אגלמז', month: 6, day: 11 } as any,
        photoUrls: [],
        blessingPageSlug: 'bare-2026',
        blessingPageIsPublic: false,
      },
    ],
    pastEvents: [],
  };
  const partyNameEvent: CadenceDigestPayload = {
    ...FIXTURE,
    comingEvents: [
      {
        event: { ...FIXTURE.comingEvents[0].event, id: 'party', name: 'מסיבת לילה אגלמז!', month: 6, day: 18 } as any,
        photoUrls: [],
        blessingPageSlug: 'party-2026',
        blessingPageIsPublic: false,
      },
    ],
    pastEvents: [],
  };

  const bareHtml = DigestTemplateService.buildMonthlyDigestEmail(bareNameEvent, {
    locale: 'he',
    siteName: 'אתר המשפחה',
    recipientName: 'Test',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  }).html;
  const partyHtml = DigestTemplateService.buildMonthlyDigestEmail(partyNameEvent, {
    locale: 'he',
    siteName: 'אתר המשפחה',
    recipientName: 'Test',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  }).html;

  assert.ok(bareHtml.includes('יום ההולדת של אורן אגלמז'), 'bare-name birthday event must get the auto birthday label');
  assert.ok(!partyHtml.includes('יום ההולדת של'), 'a name that already reads as a celebration title must not get double-labeled');
  assert.ok(partyHtml.includes('מסיבת לילה אגלמז!'), 'celebration-title event name must render unchanged');
  console.log('bare-name birthday events get an auto label, celebration-title names do not: PASSED');
}

function testWriteBlessingLinkOnComingEventsOnly() {
  // Coming events invite writing a blessing; past events (already happened) do not
  // (Agla, 2026-07-22: "the invite to write blessing on site is missing").
  // Recipient name deliberately distinct from any event name - see
  // testComingSectionSplitsByMonth for why (the greeting would otherwise collide
  // with the first occurrence lookup below).
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  const moshIdx = html.indexOf('Grandpa Moshe');
  // Window widened past 600: every /app/* link in the block now carries a `?rt=` read-only
  // token (famcircle#127), pushing the CTA text further from the event name than before.
  const moshBlock = html.slice(moshIdx, moshIdx + 700);
  assert.ok(moshBlock.includes('/app/blessing/e1-2026'), 'coming event must link to its blessing page');
  assert.ok(moshBlock.includes('Write a blessing'), 'coming event must show the write-a-blessing CTA text');

  const sarahIdx = html.indexOf('Grandma Sarah');
  const sarahBlock = html.slice(sarahIdx, sarahIdx + 700);
  assert.ok(!sarahBlock.includes('/app/blessing/e2-standing'), 'past event must not show a write-a-blessing link');
  console.log('write-a-blessing link shows for coming events only: PASSED');
}

function testDeathEventCtaReadsAsMemorialNotBlessing() {
  // A death/yahrzeit event isn't a "blessing" occasion - the coming-event CTA must read
  // as memorial/remembrance wording instead (Agla, 2026-07-22, pointing at a death-event
  // digest row showing "כתבו ברכה").
  const payload: CadenceDigestPayload = {
    ...FIXTURE,
    comingEvents: [
      {
        event: {
          id: 'e4',
          siteId: 'site1',
          ownerId: 'owner1',
          name: 'Grandpa Yosef',
          type: 'death',
          date: null,
          month: 8,
          day: 29,
          year: 2026,
          isAnnual: true,
          imageUrl: 'https://example.com/photos/yosef.jpg',
          createdAt: null,
        } as any,
        photoUrls: ['https://example.com/photos/yosef.jpg'],
        blessingPageSlug: 'e4-2026',
        blessingPageIsPublic: false,
      },
    ],
    pastEvents: [],
  };
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(payload, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  const yosefIdx = html.indexOf('Grandpa Yosef');
  const yosefBlock = html.slice(yosefIdx, yosefIdx + 800);
  assert.ok(yosefBlock.includes('/app/blessing/e4-2026'), 'coming death event must link to its blessing page');
  assert.ok(yosefBlock.includes('memorial note'), 'coming death event must show memorial CTA wording');
  assert.ok(!yosefBlock.includes('Write a blessing'), 'coming death event must not show blessing CTA wording');
  console.log('death event coming-CTA reads as memorial, not blessing: PASSED');
}

function testPastDeathEventWithPublicBlessingPageLinksToMemorial() {
  // famcircle#81: a past-section death event with an existing PUBLIC blessing page
  // must link straight to /public/memorial/{slug} instead of the generic calendar link.
  const payload: CadenceDigestPayload = {
    ...FIXTURE,
    comingEvents: [],
    pastEvents: [
      {
        ...FIXTURE.pastEvents[0],
        blessingPageSlug: 'e2-standing',
        blessingPageIsPublic: true,
      },
    ],
  };
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(payload, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  const sarahIdx = html.indexOf('Grandma Sarah');
  const sarahBlock = html.slice(Math.max(0, sarahIdx - 200), sarahIdx);
  assert.ok(
    sarahBlock.includes('<a href="https://example.com/public/memorial/e2-standing"'),
    'past death event with a public blessing page must link to its memorial page',
  );
  console.log('past death event with a public blessing page links to /public/memorial/{slug}: PASSED');
}

function testPastDeathEventWithoutPublicBlessingPageFallsBackToCalendar() {
  // Same event, but the blessing page is NOT public (or doesn't exist) - must fall back
  // to the calendar link, never a broken or private link (famcircle#81 landmine).
  const html = buildFixtureHtml();
  const sarahIdx = html.indexOf('Grandma Sarah');
  const sarahBlock = html.slice(Math.max(0, sarahIdx - 200), sarahIdx);
  assert.ok(
    sarahBlock.includes(`<a href="${CALENDAR_URL}?rt=${TEST_READ_TOKEN}"`),
    'past death event without a public blessing page must fall back to the calendar link',
  );
  assert.ok(!sarahBlock.includes('/public/memorial/'), 'must never link to a memorial page that is not public');
  console.log('past death event without a public blessing page falls back to the calendar link: PASSED');
}

function testFooterManageLinkCarriesReadOnlyTokenAndNeverPointsAtProfile() {
  // famcircle#128: the footer manage-preferences link must use the same read-only-token
  // path as the calendar/gallery links (family-digest-formats-spec.md §7) - never the
  // login-gated /app/profile page.
  const { html, text } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  assert.ok(
    html.includes(`<a href="${MANAGE_URL}?rt=${TEST_READ_TOKEN}">`),
    'footer must link to manageUrl carrying the recipient read-only token as ?rt=',
  );
  assert.ok(!html.includes('/app/profile'), 'footer must never link to the login-gated /app/profile page');
  assert.ok(text.includes(`${MANAGE_URL}?rt=${TEST_READ_TOKEN}`), 'plain-text footer must also carry the manage link with its read-only token');
  console.log('footer manage-preferences link carries the read-only token and never points at /app/profile: PASSED');
}

function testCalendarLinkStaysUnwrappedWithoutClickTrackingToken() {
  // Backward-compat: a caller that doesn't pass emailTrackingClickToken (e.g. the dev/admin
  // preview renderer, which isn't a real send) must get the exact same rt-only link as before.
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
  });
  assert.ok(html.includes(`<a href="${CALENDAR_URL}?rt=${TEST_READ_TOKEN}"`), 'without a click token, calendar links must stay rt-only, unwrapped');
  assert.ok(!html.includes('/api/track/click/'), 'without a click token, no click-tracking redirect should appear at all');
  console.log('calendar link stays unwrapped when no click-tracking token is supplied: PASSED');
}

function testCalendarLinkIsClickTrackedAndStillCarriesReadOnlyTokenAfterRedirect() {
  // The real live bug (Agla, 2026-08-08): clicking a digest link into the calendar was never
  // recorded, because no digest link was ever wrapped through the click-tracking redirect.
  // This proves both halves of the fix: (1) the link now goes through /api/track/click/, and
  // (2) critically, the DESTINATION it redirects to (the `u` param) still carries `?rt=` - the
  // read-only-token and click-tracking wraps must nest in the right order or opening the
  // magazine from the email would silently lose read-only access again (famcircle#127/#138).
  const TEST_CLICK_TOKEN = 'test-click-token';
  const { html } = DigestTemplateService.buildMonthlyDigestEmail(FIXTURE, {
    locale: 'en',
    siteName: 'The Aglamaz Family',
    recipientName: 'Test Recipient',
    calendarUrl: CALENDAR_URL,
    galleryUrl: GALLERY_URL,
    manageUrl: MANAGE_URL,
    readOnlyToken: TEST_READ_TOKEN,
    emailTrackingClickToken: TEST_CLICK_TOKEN,
  });

  const hrefMatch = html.match(/<a href="([^"]*\/api\/track\/click\/[^"]*)"/);
  assert.ok(hrefMatch, 'a calendar-link <a> must point through /api/track/click/ when a click-tracking token is supplied');

  const wrappedUrl = new URL(hrefMatch![1].replace(/&amp;/g, '&'));
  assert.equal(wrappedUrl.pathname, `/api/track/click/${TEST_CLICK_TOKEN}`, 'click-tracking path must carry this recipient copy-specific token');

  const destination = wrappedUrl.searchParams.get('u');
  assert.ok(destination, 'the click-tracking link must carry a u= destination param');
  assert.equal(destination, `${CALENDAR_URL}?rt=${TEST_READ_TOKEN}`, 'the destination behind the click redirect must still carry the read-only token, or opening the magazine from the email breaks the no-login-prompt flow');

  console.log('calendar link is click-tracked and its redirect destination still carries the read-only token: PASSED');
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
  testComingSectionSplitsByMonth();
  testDeathEventShowsHebrewDate();
  testHeadingHierarchy();
  testNoRedundantIntroLine();
  testGeneralPhotosUseCollageNotThumbnailRow();
  testAnnualEventShowsTargetYearNotOriginalEntryYear();
  testBirthdayEventNameAutoLabel();
  testWriteBlessingLinkOnComingEventsOnly();
  testDeathEventCtaReadsAsMemorialNotBlessing();
  testPastDeathEventWithPublicBlessingPageLinksToMemorial();
  testPastDeathEventWithoutPublicBlessingPageFallsBackToCalendar();
  testFooterManageLinkCarriesReadOnlyTokenAndNeverPointsAtProfile();
  testCalendarLinkStaysUnwrappedWithoutClickTrackingToken();
  testCalendarLinkIsClickTrackedAndStillCarriesReadOnlyTokenAfterRedirect();
}

run();
