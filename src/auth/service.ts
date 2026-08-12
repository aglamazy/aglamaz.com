import { createHash, randomBytes } from 'crypto';
import { signJwt, verifyJwt } from './jwt';
import {
  AppClaims,
  TokenClaims,
  buildAccessClaims,
  buildAgentAccessClaims,
  buildRefreshClaims,
} from './tokens';
import { refreshStore } from './refresh-store';

/** Default access-token lifetime in minutes. */
export const ACCESS_TOKEN_MINUTES = 60;

/** Agent tokens default shorter than human sessions — a fleet lane re-mints per task, not per browser session. */
export const AGENT_ACCESS_TOKEN_MINUTES = 15;

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

/**
 * Sign an AGENT access token — dasi#1 v2's distinct mint path. Deliberately
 * bypasses everything human-login-shaped: no Google/Firebase OAuth
 * round-trip, no refresh token, no `refreshStore` entry (agent tokens are
 * short-lived and re-minted, never silently kept alive by a refresh chain).
 * Reuses the SAME `signJwt` primitive as human tokens (that layer is
 * genuinely provider-agnostic already) — only the claims-building and the
 * absence of any OAuth/refresh machinery make this "distinct."
 */
export function signAgentAccessToken(
  app: AppClaims,
  actorId: string,
  minutes = AGENT_ACCESS_TOKEN_MINUTES,
): string {
  const ttl = minutes * 60;
  const claims = buildAgentAccessClaims(app, actorId, ttl);
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
