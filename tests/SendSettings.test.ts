// F7-A (famcircle#119): resolveSendSettingsForSite is the ONE function every cron route,
// BlogAutogenService, and the admin send-settings API resolve on/off through - "the sender
// reads this same table" is the literal acceptance bar, so this pins the resolution rules
// directly (no Firestore needed - it's a pure function over an ISite-shaped object).
import assert from 'node:assert/strict';
import { resolveSendSettingsForSite } from '../src/repositories/SiteRepository';
import type { ISite } from '../src/entities/Site';

function testDefaultsWhenNothingConfigured() {
  // The real-world default for every existing site before this table existed: digest,
  // in-day reminders and yahrzeit WhatsApp had no site-level switch at all (member prefs /
  // event matching decided everything) so they must stay on; blogAutogen's existing
  // consent gate defaulted off.
  const site = { id: 'site1' } as ISite;
  assert.deepEqual(resolveSendSettingsForSite(site), {
    digest: true,
    inDayReminders: true,
    yahrzeitWhatsapp: true,
    blogAutogen: false,
  });
  console.log('defaults-when-nothing-configured test passed');
}

function testExplicitOffOverridesDefault() {
  const site = {
    id: 'site1',
    sendSettings: { digest: { enabled: false } },
  } as ISite;
  assert.equal(resolveSendSettingsForSite(site).digest, false);
  // Untouched types keep their default.
  assert.equal(resolveSendSettingsForSite(site).inDayReminders, true);
  console.log('explicit-off-overrides-default test passed');
}

function testExplicitOnOverridesLegacyDefaultOff() {
  const site = {
    id: 'site1',
    sendSettings: { blogAutogen: { enabled: true } },
  } as ISite;
  assert.equal(resolveSendSettingsForSite(site).blogAutogen, true);
  console.log('explicit-on-overrides-legacy-default-off test passed');
}

function testLegacyBlogAutogenEnabledFallsBackWhenNoSendSettings() {
  // A site that had blogAutogenEnabled set directly (pre-F7-A, via script - see
  // BlogAutogenService's original consent-gate comment) before ever touching the new
  // table must keep behaving the way it always did.
  const site = { id: 'site1', blogAutogenEnabled: true } as ISite;
  assert.equal(resolveSendSettingsForSite(site).blogAutogen, true);
  console.log('legacy-blogAutogenEnabled-fallback test passed');
}

function testExplicitSendSettingsWinsOverLegacyField() {
  // No shadow config: once sendSettings.blogAutogen exists, it is the ONLY source read -
  // a stale legacy field must never win.
  const site = {
    id: 'site1',
    blogAutogenEnabled: true,
    sendSettings: { blogAutogen: { enabled: false } },
  } as ISite;
  assert.equal(resolveSendSettingsForSite(site).blogAutogen, false);
  console.log('explicit-sendSettings-wins-over-legacy-field test passed');
}

function run() {
  testDefaultsWhenNothingConfigured();
  testExplicitOffOverridesDefault();
  testExplicitOnOverridesLegacyDefaultOff();
  testLegacyBlogAutogenEnabledFallsBackWhenNoSendSettings();
  testExplicitSendSettingsWinsOverLegacyField();
}

run();
