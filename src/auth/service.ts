import { createHash, randomBytes } from 'crypto';
import { signJwt, verifyJwt } from './jwt';
import {
  AppClaims,
  TokenClaims,
  buildAccessClaims,
  buildRefreshClaims,
} from './tokens';
import { refreshStore } from './refresh-store';

/** Default access-token lifetime in minutes. */
export const ACCESS_TOKEN_MINUTES = 60;

/** Default refresh-token lifetime in days. */
export const REFRESH_TOKEN_DAYS = 30;

/** Hash a token using SHA-256 hex. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Sign an access token. */
export function signAccessToken(app: AppClaims, minutes = ACCESS_TOKEN_MINUTES): string {
  const ttl = minutes * 60;
  const claims = buildAccessClaims(app, ttl);
  return signJwt(claims, { expiresInSec: ttl });
}

/** Sign and store a refresh token. */
export function signRefreshToken(app: AppClaims, days = REFRESH_TOKEN_DAYS): string {
  const jti = randomBytes(16).toString('hex');
  const ttl = days * 24 * 60 * 60;
  const claims = buildRefreshClaims(app, days, jti);
  const token = signJwt(claims, { expiresInSec: ttl, jti });
  refreshStore.put(app.userId, hashToken(token));
  return token;
}

/** Verify an access token. */
export function verifyAccessToken(token: string): TokenClaims | null {
  return verifyJwt(token);
}

/** Verify a refresh token and detect reuse. */
export function verifyRefreshToken(token: string): TokenClaims | null {
  const payload = verifyJwt(token);
  if (!payload?.sub) return null;
  return payload;
}

/** Rotate refresh token for the given app claims. */
export function rotateRefreshToken(app: AppClaims): string {
  return signRefreshToken(app);
}

/** Revoke a refresh token for user. */
export function revokeRefreshToken(userId: string) {
  refreshStore.del(userId);
}

export type { AppClaims, TokenClaims } from './tokens';
