/**
 * Tests for toPlainDescription (src/utils/seo.ts)
 *
 * SEO focus: Google's meta description guidance is ~160 chars. The audit
 * (famcircle.org scored 60/100) flagged the previous 200-char cap as too
 * long. This verifies the cap is enforced end-to-end, including the
 * ellipsis appended on truncation.
 */

import assert from 'node:assert/strict';
import { toPlainDescription } from '../src/utils/seo';

const META_DESCRIPTION_MAX = 160;

function testTruncatesLongPlainText() {
  const raw = 'A'.repeat(250);
  const result = toPlainDescription(raw);
  assert.ok(result, 'expected a description for non-empty input');
  assert.ok(
    result!.length <= META_DESCRIPTION_MAX,
    `expected length <= ${META_DESCRIPTION_MAX}, got ${result!.length}`
  );
  assert.ok(result!.endsWith('…'), 'expected truncated text to end with an ellipsis');
}

function testTruncatesLongHtmlContent() {
  // Simulates a rich-text "about" field with markup and entities.
  const raw = `<p>${'Family history &amp; stories '.repeat(10)}</p>`;
  const result = toPlainDescription(raw);
  assert.ok(result, 'expected a description for HTML input');
  assert.ok(
    result!.length <= META_DESCRIPTION_MAX,
    `expected length <= ${META_DESCRIPTION_MAX}, got ${result!.length}`
  );
  assert.ok(!/[<>]/.test(result!), 'expected HTML tags to be stripped');
  assert.ok(result!.endsWith('…'), 'expected truncated text to end with an ellipsis');
}

function testShortTextPassesThroughUnchanged() {
  const raw = 'A short family site description.';
  const result = toPlainDescription(raw);
  assert.equal(result, raw);
}

function testEmptyInputReturnsUndefined() {
  assert.equal(toPlainDescription(undefined), undefined);
  assert.equal(toPlainDescription(''), undefined);
  assert.equal(toPlainDescription('<p></p>'), undefined);
}

function run() {
  testTruncatesLongPlainText();
  testTruncatesLongHtmlContent();
  testShortTextPassesThroughUnchanged();
  testEmptyInputReturnsUndefined();
  console.log('seo.test.ts: all tests passed');
}

run();
