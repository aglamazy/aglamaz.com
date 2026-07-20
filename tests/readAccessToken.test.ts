import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { generateReadToken, verifyReadToken } from '../src/services/ReadAccessTokenService';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

function testValidTokenRoundTrips() {
  const token = generateReadToken({ memberId: 'member1', siteId: 'site1', ttlHours: 1 });
  const payload = verifyReadToken(token);
  assert.ok(payload);
  assert.equal(payload?.memberId, 'member1');
  assert.equal(payload?.siteId, 'site1');
  console.log('valid token round-trip test passed');
}

function testExpiredTokenReturnsNull() {
  const token = generateReadToken({ memberId: 'member1', siteId: 'site1', ttlHours: -1 });
  const payload = verifyReadToken(token);
  assert.equal(payload, null);
  console.log('expired token test passed');
}

function testTamperedTokenReturnsNull() {
  const token = generateReadToken({ memberId: 'member1', siteId: 'site1', ttlHours: 1 });
  const lastChar = token.at(-1);
  const flippedChar = lastChar === 'A' ? 'B' : 'A';
  const tampered = token.slice(0, -1) + flippedChar;

  assert.notEqual(tampered, token);
  const payload = verifyReadToken(tampered);
  assert.equal(payload, null);
  console.log('tampered token test passed');
}

function run() {
  testValidTokenRoundTrips();
  testExpiredTokenReturnsNull();
  testTamperedTokenReturnsNull();
}

run();
