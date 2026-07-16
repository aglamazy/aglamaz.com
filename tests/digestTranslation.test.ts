/**
 * Tests for DigestTranslationService.translateDigestContent
 *
 * QA focus: Hebrew RTL correctness — the landmine documented in CLAUDE.md is that
 * missing i18n keys silently fall back to English and break RTL. Here we verify
 * that translated digest strings are actually populated (not empty/undefined) so
 * the email renderer receives real Hebrew text, not a silent English fallback.
 *
 * The OpenAI call is mocked via the translateFn injection point — no live API key needed.
 */

import assert from 'node:assert/strict';
import type { DigestPayload } from '../src/services/DigestTranslationService';
import { translateDigestContent } from '../src/services/DigestTranslationService';

// Fixture payload matching famcircle#20's documented output shape {events, photos}
const FIXTURE_PAYLOAD: DigestPayload = {
  events: [
    {
      name: "Grandpa Moshe's Birthday",
      description: 'Celebrating 85 years',
      type: 'birthday',
      date: 'July 20, 2026',
    },
    {
      name: 'Anniversary of Grandma Sarah',
      type: 'death',
      date: 'July 25, 2026',
      hebrewDate: 'כ"ט תמוז תשפ"ו',
    },
  ],
  photos: [
    {
      caption: 'Family gathering at the beach',
      url: 'https://example.com/photo1.jpg',
      takenAt: 'July 4, 2026',
    },
    {
      url: 'https://example.com/photo2.jpg',
      // no caption — should remain undefined after translation
    },
  ],
};

// Simulated Hebrew translations (stand-in for OpenAI response)
const MOCK_HE: Record<string, string> = {
  "Grandpa Moshe's Birthday": 'יום הולדת סבא משה',
  'Celebrating 85 years': 'חוגגים 85 שנה',
  'Anniversary of Grandma Sarah': 'יום הזכרון לסבתא שרה',
  'Family gathering at the beach': 'כינוס משפחתי על החוף',
};

async function testTranslateToHebrew() {
  const calls: Array<{ text: string; from: string; to: string }> = [];

  const mockTranslateFn = async (text: string, from: string, to: string): Promise<string> => {
    calls.push({ text, from, to });
    const translated = MOCK_HE[text];
    // Hebrew QA: assert the translation is non-empty — simulates the CLAUDE.md landmine check
    assert.ok(translated, `No mock Hebrew translation for "${text}" — add it to MOCK_HE`);
    return translated;
  };

  const result = await translateDigestContent(FIXTURE_PAYLOAD, 'he', {
    sourceLocale: 'en',
    translateFn: mockTranslateFn,
  });

  // All translateFn calls must target Hebrew with English source
  assert.ok(calls.length > 0, 'translateFn should have been called at least once');
  assert.ok(calls.every(c => c.to === 'he'), 'all calls must target Hebrew');
  assert.ok(calls.every(c => c.from === 'en'), 'all calls must declare English source');

  // Event[0]: name and description translated
  assert.equal(result.events[0].name, 'יום הולדת סבא משה');
  assert.equal(result.events[0].description, 'חוגגים 85 שנה');

  // Event[0]: non-text fields preserved unchanged
  assert.equal(result.events[0].type, 'birthday');
  assert.equal(result.events[0].date, 'July 20, 2026');

  // Event[1]: name translated, no description to translate
  assert.equal(result.events[1].name, 'יום הזכרון לסבתא שרה');
  assert.equal(result.events[1].description, undefined);

  // hebrewDate is already localised — must NOT be passed through translateFn
  assert.equal(result.events[1].hebrewDate, 'כ"ט תמוז תשפ"ו');
  const translatedTexts = calls.map(c => c.text);
  assert.ok(!translatedTexts.includes('כ"ט תמוז תשפ"ו'), 'hebrewDate must not be re-translated');

  // Photo[0]: caption translated; non-text fields preserved
  assert.equal(result.photos[0].caption, 'כינוס משפחתי על החוף');
  assert.equal(result.photos[0].url, 'https://example.com/photo1.jpg');
  assert.equal(result.photos[0].takenAt, 'July 4, 2026');

  // Photo[1]: no caption → stays undefined (no extra field added)
  assert.equal(result.photos[1].caption, undefined);

  // Exactly 4 translateFn calls: 2 event names + 1 description + 1 caption
  assert.equal(calls.length, 4, `expected 4 translation calls, got ${calls.length}`);
  assert.ok(translatedTexts.includes("Grandpa Moshe's Birthday"));
  assert.ok(translatedTexts.includes('Celebrating 85 years'));
  assert.ok(translatedTexts.includes('Anniversary of Grandma Sarah'));
  assert.ok(translatedTexts.includes('Family gathering at the beach'));

  console.log(`translateDigestContent->Hebrew: PASSED (${calls.length} translation calls, all strings populated)`);
}

async function testSameLocaleSkipsTranslation() {
  let called = false;
  const mockTranslateFn = async () => { called = true; return 'translated'; };

  const result = await translateDigestContent(FIXTURE_PAYLOAD, 'en', {
    sourceLocale: 'en',
    translateFn: mockTranslateFn,
  });

  assert.equal(called, false, 'translateFn must NOT be called when source equals target');
  assert.strictEqual(result, FIXTURE_PAYLOAD, 'same-locale must return the original payload object unchanged');
  console.log('translateDigestContent->same-locale no-op: PASSED');
}

async function testEmptyPayload() {
  const emptyPayload: DigestPayload = { events: [], photos: [] };
  let called = false;
  const mockTranslateFn = async () => { called = true; return 'translated'; };

  const result = await translateDigestContent(emptyPayload, 'he', {
    sourceLocale: 'en',
    translateFn: mockTranslateFn,
  });

  assert.equal(called, false, 'translateFn must not be called for empty payload');
  assert.deepEqual(result, emptyPayload);
  console.log('translateDigestContent->empty payload: PASSED');
}

async function testEmptyStringsNotTranslated() {
  const payloadWithEmpties: DigestPayload = {
    events: [{ name: 'Real Name', description: '' }],
    photos: [{ caption: '   ' }],
  };
  const calls: string[] = [];
  const mockTranslateFn = async (text: string, _from: string, _to: string) => {
    calls.push(text);
    return `[HE:${text}]`;
  };

  const result = await translateDigestContent(payloadWithEmpties, 'he', {
    sourceLocale: 'en',
    translateFn: mockTranslateFn,
  });

  // Empty string description and whitespace-only caption must not be sent to translator
  assert.ok(!calls.includes(''), 'empty string must not be translated');
  assert.ok(!calls.includes('   '), 'whitespace-only string must not be translated');
  // But the real name should still be translated
  assert.ok(calls.includes('Real Name'));
  assert.equal(result.events[0].name, '[HE:Real Name]');
  // Empty/whitespace fields preserved as-is
  assert.equal(result.events[0].description, '');
  assert.equal(result.photos[0].caption, '   ');
  console.log('translateDigestContent->empty strings skipped: PASSED');
}

async function run() {
  await testTranslateToHebrew();
  await testSameLocaleSkipsTranslation();
  await testEmptyPayload();
  await testEmptyStringsNotTranslated();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
