import { signJwt, verifyJwt } from '@/auth/jwt';
import type { TokenClaims } from '@/auth/tokens';

// famcircle#62 owns the canonical generateReadToken/verifyReadToken (per
// docs/family-digest-formats-spec.md §7). #62 isn't merged/available on any branch yet, so
// famcircle#63 implements the same shape locally from the spec to unblock the auth-path wiring.
// Once #62 lands, this file should be deleted and its call sites repointed at #62's version.

// Exported so the Edge-runtime verifier (src/lib/edgeAuth.ts:verifyReadTokenEdge, used by
// src/proxy.ts since middleware/proxy runs in the Edge runtime where Node's `crypto` module
// used by verifyJwt below is unavailable) checks the same audience value, not a copy of it.
export const READ_TOKEN_AUDIENCE = 'read-only-access';
// Matches ReminderPreferenceLinkService's magic-link lifetime (src/services/ReminderPreferenceLinkService.ts).
const READ_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

export interface ReadTokenClaims extends TokenClaims {
  memberId: string;
}

export interface ReadTokenPayload {
  memberId: string;
  siteId: string;
}

/** Sign a read-only access token scoped to one member on one site. Grants READ access only —
 * verifyReadToken's payload must never be accepted by a write-capable route as sufficient auth. */
export function generateReadToken(params: ReadTokenPayload): string {
  const claims: ReadTokenClaims = {
    sub: params.memberId,
    aud: READ_TOKEN_AUDIENCE,
    userId: params.memberId,
    siteId: params.siteId,
    role: 'member',
    firstName: '',
    memberId: params.memberId,
  };

  return signJwt(claims as TokenClaims, {
    expiresInSec: READ_TOKEN_TTL_SECONDS,
    audience: READ_TOKEN_AUDIENCE,
    subject: params.memberId,
  });
}

/** Verify a read-only access token. Returns null if missing, expired, or malformed. */
export function verifyReadToken(token: string): ReadTokenPayload | null {
  const payload = verifyJwt(token, { checkAud: READ_TOKEN_AUDIENCE });
  if (!payload) return null;

  const memberId = (payload as ReadTokenClaims).memberId;
  const siteId = payload.siteId;
  if (typeof memberId !== 'string' || !memberId.trim()) return null;
  if (typeof siteId !== 'string' || !siteId.trim()) return null;
  if (payload.sub !== memberId) return null;

  return { memberId, siteId };
}
