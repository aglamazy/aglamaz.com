import { signJwt, verifyJwt } from './jwt';
import { nowSeconds, inSeconds } from './tokens';

export const READ_TOKEN_AUDIENCE = 'read-token';

// 6 hours: covers "I'll read this email later today" window.
// Shorter than the 24h review-token TTL because this token is meant to be
// clicked immediately; if it expires, users can log in normally.
export const READ_TOKEN_TTL_HOURS = 6;
const READ_TOKEN_TTL_SEC = READ_TOKEN_TTL_HOURS * 3600;

export interface ReadTokenPayload {
  memberId: string; // Firebase UID of the member
  siteId: string;
}

/**
 * Sign a short-lived read-only token for embedding in email links.
 * The token grants read-only access to site content without a Firebase session.
 */
export function signReadToken(memberId: string, siteId: string): string {
  return signJwt(
    {
      sub: memberId,
      userId: memberId,
      siteId,
      role: 'member',
      firstName: '',
      iat: nowSeconds(),
      exp: inSeconds(READ_TOKEN_TTL_SEC),
    },
    {
      expiresInSec: READ_TOKEN_TTL_SEC,
      audience: READ_TOKEN_AUDIENCE,
    }
  );
}

/**
 * Verify a read token and return its payload.
 * Returns null if the token is missing, invalid, expired, or wrong audience.
 */
export function verifyReadToken(token: string): ReadTokenPayload | null {
  const payload = verifyJwt(token, { checkAud: READ_TOKEN_AUDIENCE });
  if (!payload?.sub || !payload.siteId) return null;
  return { memberId: payload.sub, siteId: payload.siteId };
}
