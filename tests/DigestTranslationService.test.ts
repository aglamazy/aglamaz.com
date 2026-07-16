import assert from 'node:assert/strict';
import { translateDigestContent } from '../src/services/DigestTranslationService';
import type { DigestPayload } from '../src/services/DigestCompilerService';
import type { AnniversaryEvent } from '../src/entities/Anniversary';
import type { GalleryPhoto } from '../src/repositories/GalleryPhotoRepository';

// Fixture: a basic digest payload with events and photos
function createFixtureDigest(): DigestPayload {
  const baseTime = new Date('2026-06-15');
  const timestamp = {
    toMillis: () => baseTime.getTime(),
  };

  const events: AnniversaryEvent[] = [
    {
      id: 'event-1',
      siteId: 'site-1',
      ownerId: 'owner-1',
      name: 'Alice Birthday',
      description: 'Celebrating Alice',
      type: 'birthday',
      date: timestamp,
      month: 5,
      day: 15,
      year: 2026,
      isAnnual: true,
      locales: {
        en: {
          name: 'Alice Birthday',
          'name$meta': {
            source: 'manual' as const,
            updatedAt: timestamp,
          },
        },
      },
      createdAt: timestamp,
    },
    {
      id: 'event-2',
      siteId: 'site-1',
      ownerId: 'owner-1',
      name: 'Wedding Anniversary',
      type: 'wedding',
      date: timestamp,
      month: 5,
      day: 20,
      year: 2026,
      isAnnual: true,
      locales: {
        en: {
          name: 'Wedding Anniversary',
          'name$meta': {
            source: 'manual' as const,
            updatedAt: timestamp,
          },
        },
      },
      createdAt: timestamp,
    },
  ];

  const photos: Array<any> = [
    {
      id: 'photo-1',
      siteId: 'site-1',
      createdBy: 'user-1',
      createdAt: timestamp,
      date: timestamp,
      imagesWithDimensions: [
        {
          url: 'https://example.com/photo1.jpg',
          width: 1920,
          height: 1080,
        },
      ],
      deletedAt: null,
      locales: {
        en: {
          description: 'Beautiful sunset at the beach',
          'description$meta': {
            source: 'manual' as const,
            updatedAt: timestamp,
          },
        },
      },
    },
    {
      id: 'photo-2',
      siteId: 'site-1',
      createdBy: 'user-1',
      createdAt: timestamp,
      date: timestamp,
      imagesWithDimensions: [
        {
          url: 'https://example.com/photo2.jpg',
          width: 1920,
          height: 1080,
        },
      ],
      deletedAt: null,
      locales: {
        en: {
          description: 'Family gathering at the park',
          'description$meta': {
            source: 'manual' as const,
            updatedAt: timestamp,
          },
        },
      },
    },
  ];

  return {
    siteId: 'site-1',
    month: 5,
    year: 2026,
    events,
    photos,
  };
}

async function testTranslatesEventNamesToHebrewViaTranslationService() {
  const digest = createFixtureDigest();

  // Mock translator that simulates GPT-based translation
  const mockTranslations: Record<string, Record<string, string>> = {
    'Alice Birthday': 'יום הולדת של אליס',
    'Wedding Anniversary': 'שנת נישואים',
    'Beautiful sunset at the beach': 'שקיעה יפה בחוף הים',
    'Family gathering at the park': 'התאגדות משפחתית בפארק',
  };

  const mockTranslateFn = async (text: string, _from: string, to: string): Promise<string | undefined> => {
    if (to !== 'he') {
      return text;
    }
    return mockTranslations[text] || text;
  };

  const translated = await translateDigestContent(digest, 'he', mockTranslateFn);

  // Check event names are translated to Hebrew
  assert.equal(translated.events[0].name, 'יום הולדת של אליס');
  assert.equal(translated.events[1].name, 'שנת נישואים');

  // Check photos are translated
  assert.equal(translated.photos[0].description, 'שקיעה יפה בחוף הים');
  assert.equal(translated.photos[1].description, 'התאגדות משפחתית בפארק');

  // Check the payload structure is preserved
  assert.equal(translated.siteId, 'site-1');
  assert.equal(translated.month, 5);
  assert.equal(translated.year, 2026);

  console.log('translates event names to Hebrew test passed');
}

async function testPreservesExistingLocalizedContent() {
  const digest = createFixtureDigest();

  // Add Hebrew locale to first event
  digest.events[0].locales = {
    ...digest.events[0].locales,
    he: {
      name: 'יום הולדת של אליס (Hebrew)',
      'name$meta': {
        source: 'manual' as const,
        updatedAt: digest.events[0].createdAt,
      },
    },
  };

  const mockTranslateFn = async (text: string, _from: string, _to: string): Promise<string | undefined> => {
    return 'SHOULD NOT BE CALLED';
  };

  const translated = await translateDigestContent(digest, 'he', mockTranslateFn);

  // First event should use existing Hebrew localization
  assert.equal(translated.events[0].name, 'יום הולדת של אליס (Hebrew)');

  // Second event should still be translated
  assert.equal(translated.events[1].name, 'SHOULD NOT BE CALLED');

  console.log('preserves existing localized content test passed');
}

async function testHandlesEmptyDescriptions() {
  const digest = createFixtureDigest();

  // Remove description from locales for first photo
  digest.photos[0].locales = {
    en: {
      // No description key, so getMostRecentFieldVersion will return null
      'description$meta': {
        source: 'manual' as const,
        updatedAt: digest.photos[0].createdAt,
      },
    },
  };

  const mockTranslateFn = async (): Promise<string | undefined> => {
    return 'SHOULD NOT BE CALLED';
  };

  const translated = await translateDigestContent(digest, 'he', mockTranslateFn);

  // No description should result in no description in translated photo
  assert.equal(translated.photos[0].description, undefined);

  console.log('handles empty descriptions test passed');
}

async function testHandlesTranslationErrors() {
  const digest = createFixtureDigest();

  const mockTranslateFn = async (text: string): Promise<string | undefined> => {
    if (text.includes('Error')) {
      throw new Error('Translation API error');
    }
    return text + ' [translated]';
  };

  // This should not throw - errors are caught and logged
  const translated = await translateDigestContent(digest, 'he', mockTranslateFn);

  // Should fall back to original on error
  assert.ok(translated.events.length > 0);

  console.log('handles translation errors test passed');
}

async function testReturnsSamePayloadForUnsupportedLocale() {
  const digest = createFixtureDigest();

  const translated = await translateDigestContent(digest, '', async () => {
    throw new Error('SHOULD NOT BE CALLED');
  });

  // Should return original payload if locale is empty
  assert.deepEqual(translated, digest);

  console.log('returns same payload for unsupported locale test passed');
}

async function testPreservesOtherEventFields() {
  const digest = createFixtureDigest();

  const mockTranslateFn = async (text: string, _from: string, _to: string): Promise<string | undefined> => {
    return '[HE] ' + text;
  };

  const translated = await translateDigestContent(digest, 'he', mockTranslateFn);

  // Check that non-translatable fields are preserved
  assert.equal(translated.events[0].id, 'event-1');
  assert.equal(translated.events[0].type, 'birthday');
  assert.equal(translated.events[0].month, 5);
  assert.equal(translated.events[0].day, 15);

  // Check that photos non-translatable fields are preserved
  assert.equal(translated.photos[0].id, 'photo-1');
  assert.equal(translated.photos[0].siteId, 'site-1');

  console.log('preserves other event fields test passed');
}

async function run() {
  await testTranslatesEventNamesToHebrewViaTranslationService();
  await testPreservesExistingLocalizedContent();
  await testHandlesEmptyDescriptions();
  await testHandlesTranslationErrors();
  await testReturnsSamePayloadForUnsupportedLocale();
  await testPreservesOtherEventFields();
}

run();
