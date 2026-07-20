import { signJwt, verifyJwt } from '@/auth/jwt';
import type { TokenClaims } from '@/auth/tokens';

export interface ReadAccessTokenClaims extends TokenClaims {
  siteId: string;
}

export interface ReadAccessTokenPayload {
  memberId: string;
  siteId: string;
}

const READ_ACCESS_AUDIENCE = 'read-access';

/**
 * Default TTL for read-only access tokens: short enough that a leaked/forwarded
 * email link can't be replayed hours or days later, long enough that clicking
 * the link "now" from an inbox doesn't race an expiry.
 */
export const READ_ACCESS_TOKEN_DEFAULT_TTL_HOURS = 1;

export function generateReadToken(params: {
  memberId: string;
  siteId: string;
  ttlHours: number;
}): string {
  const claims: ReadAccessTokenClaims = {
    sub: params.memberId,
    aud: READ_ACCESS_AUDIENCE,
    userId: params.memberId,
    siteId: params.siteId,
    role: 'member',
    firstName: '',
  };

  return signJwt(claims as TokenClaims, {
    expiresInSec: Math.round(params.ttlHours * 60 * 60),
    audience: READ_ACCESS_AUDIENCE,
    subject: params.memberId,
  });
}

export function verifyReadToken(token: string): ReadAccessTokenPayload | null {
  const payload = verifyJwt(token, { checkAud: READ_ACCESS_AUDIENCE });
  if (!payload) {
    return null;
  }

  if (
    typeof payload.userId !== 'string' ||
    !payload.userId.trim() ||
    typeof payload.siteId !== 'string' ||
    !payload.siteId.trim() ||
    payload.sub !== payload.userId
  ) {
    return null;
  }

  return { memberId: payload.userId, siteId: payload.siteId };
}
