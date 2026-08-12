import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  actorFromClaims,
  buildAccessClaims,
  buildAgentAccessClaims,
} from '../src/auth/tokens';
import { signAccessToken, signAgentAccessToken, verifyAccessToken } from '../src/auth/service';

// Generate temporary RSA keys for JWT signing (same pattern as tests/auth.test.ts)
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

const app = {
  userId: 'user1',
  siteId: 'site1',
  role: 'member',
  firstName: 'Test',
};

function testActorFromClaimsHuman() {
  const actor = actorFromClaims({ sub: 'user1' });
  assert.deepEqual(actor, { kind: 'human', id: 'user1' });
  console.log('actorFromClaims: no actor claim -> defaults to human/sub');
}

function testActorFromClaimsAgent() {
  const actor = actorFromClaims({ sub: 'user1', actor: { kind: 'agent', id: 'Librarian' } });
  assert.deepEqual(actor, { kind: 'agent', id: 'Librarian' });
  console.log('actorFromClaims: agent claim present -> agent wins over sub');
}

function testActorFromClaimsThrowsWithNeither() {
  assert.throws(() => actorFromClaims({}), /neither actor\.id.*nor sub/);
  console.log('actorFromClaims: no actor.id and no sub -> throws (never silently attributes)');
}

function testBuildAgentAccessClaimsShape() {
  const claims = buildAgentAccessClaims(app, 'Shofar', 900);
  assert.equal(claims.sub, 'user1', 'principal (sub) stays the app userId, never the actor id');
  assert.deepEqual(claims.actor, { kind: 'agent', id: 'Shofar' });
  console.log('buildAgentAccessClaims: sub=principal, actor=agent — kept distinct');
}

function testHumanClaimsHaveNoActorByDefault() {
  const claims = buildAccessClaims(app, 900);
  assert.equal(claims.actor, undefined, 'human path never sets actor — absence IS the human default');
  console.log('buildAccessClaims (human path): actor is absent, not falsely set to human');
}

function testAgentTokenRoundTrips() {
  const token = signAgentAccessToken(app, 'Shofar');
  const verified = verifyAccessToken(token);
  assert.ok(verified);
  assert.equal(verified!.sub, 'user1');
  assert.deepEqual(verified!.actor, { kind: 'agent', id: 'Shofar' });
  console.log('signAgentAccessToken -> verifyAccessToken round-trips the actor claim');
}

function testHumanTokenRoundTripsWithoutActor() {
  const token = signAccessToken(app);
  const verified = verifyAccessToken(token);
  assert.ok(verified);
  assert.equal(verified!.actor, undefined);
  const derived = actorFromClaims(verified!);
  assert.deepEqual(derived, { kind: 'human', id: 'user1' });
  console.log('signAccessToken (human path) -> verifyAccessToken -> actorFromClaims resolves to human');
}

function testAgentTokenNeverSetsHumanOnlyFields() {
  // The agent mint path must never fabricate human-login-shaped state — it
  // reuses signJwt directly and skips buildAccessClaims/refreshStore entirely.
  const claims = buildAgentAccessClaims(app, 'Shofar', 900);
  assert.equal(claims.needsCredentialSetup, undefined);
  console.log('buildAgentAccessClaims does not fabricate human-only claim fields');
}

async function run() {
  testActorFromClaimsHuman();
  testActorFromClaimsAgent();
  testActorFromClaimsThrowsWithNeither();
  testBuildAgentAccessClaimsShape();
  testHumanClaimsHaveNoActorByDefault();
  testAgentTokenRoundTrips();
  testHumanTokenRoundTripsWithoutActor();
  testAgentTokenNeverSetsHumanOnlyFields();
}

run();
