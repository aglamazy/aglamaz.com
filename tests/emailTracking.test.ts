import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

// Temporary RSA keypair for JWT signing - same approach as tests/auth.test.ts.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

import {
  signEmailTrackingToken,
  verifyEmailTrackingToken,
  buildPixelTrackingUrl,
  buildClickTrackingUrl,
} from '../src/services/EmailTrackingService';
import { injectTrackingPixel } from '../src/services/emailTemplates';
import { signJwt } from '../src/auth/jwt';

const IDENTITY = {
  siteId: 'site1',
  recipientMemberId: 'member1',
  sendType: 'digest' as const,
  sendId: 'monthly:2026-07',
};

function testValidTokenRoundTrips() {
  const token = signEmailTrackingToken(IDENTITY);
  const claims = verifyEmailTrackingToken(token);
  assert.ok(claims);
  assert.equal(claims?.siteId, IDENTITY.siteId);
  assert.equal(claims?.recipientMemberId, IDENTITY.recipientMemberId);
  assert.equal(claims?.sendType, IDENTITY.sendType);
  assert.equal(claims?.sendId, IDENTITY.sendId);
  console.log('valid email tracking token round-trip passed');
}

function testTamperedTokenFailsVerification() {
  const token = signEmailTrackingToken(IDENTITY);
  const parts = token.split('.');
  // Flip the payload segment - same trick as tests/readAccessToken.test.ts's tampered-token case.
  const tampered = `${parts[0]}.${parts[1]}x.${parts[2]}`;
  assert.equal(verifyEmailTrackingToken(tampered), null);
  console.log('tampered email tracking token rejected passed');
}

function testWrongAudienceTokenFailsVerification() {
  // A token signed for a different purpose (e.g. an access token) must never verify
  // as a tracking token, even with a structurally valid signature.
  const foreignToken = signJwt(
    { sub: 'member1', userId: 'member1', siteId: 'site1', role: 'member', firstName: '' },
    { expiresInSec: 3600, audience: 'some-other-purpose', subject: 'member1' },
  );
  assert.equal(verifyEmailTrackingToken(foreignToken), null);
  console.log('wrong-audience token rejected passed');
}

function testPixelUrlIsPerCopyUnique() {
  const tokenA = signEmailTrackingToken(IDENTITY);
  const tokenB = signEmailTrackingToken({ ...IDENTITY, recipientMemberId: 'member2' });
  const urlA = buildPixelTrackingUrl('https://example.com', tokenA);
  const urlB = buildPixelTrackingUrl('https://example.com', tokenB);
  assert.notEqual(urlA, urlB);
  assert.match(urlA, /^https:\/\/example\.com\/api\/track\/pixel\//);
  console.log('pixel URL is unique per recipient passed');
}

function testClickUrlPreservesDestination() {
  const token = signEmailTrackingToken(IDENTITY);
  const url = buildClickTrackingUrl('https://example.com', token, 'https://example.com/app/calendar');
  const parsed = new URL(url);
  assert.equal(parsed.pathname.startsWith('/api/track/click/'), true);
  assert.equal(parsed.searchParams.get('u'), 'https://example.com/app/calendar');
  console.log('click URL preserves real destination passed');
}

function testInjectTrackingPixelAppendsBeforeBodyClose() {
  const html = '<html><body><p>hi</p></body></html>';
  const withPixel = injectTrackingPixel(html, 'https://example.com/api/track/pixel/abc');
  assert.match(withPixel, /<img src="https:\/\/example\.com\/api\/track\/pixel\/abc"[^>]*><\/body>/);
  console.log('injectTrackingPixel appends before </body> passed');
}

async function main() {
  testValidTokenRoundTrips();
  testTamperedTokenFailsVerification();
  testWrongAudienceTokenFailsVerification();
  testPixelUrlIsPerCopyUnique();
  testClickUrlPreservesDestination();
  testInjectTrackingPixelAppendsBeforeBodyClose();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
