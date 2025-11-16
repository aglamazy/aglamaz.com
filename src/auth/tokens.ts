export interface JwtRegisteredClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

export interface AppClaims {
  userId: string;
  siteId: string;
  role: string;
  firstName: string;
  lastName?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  needsCredentialSetup?: boolean;
}

export type TokenClaims = JwtRegisteredClaims & AppClaims;

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const inSeconds = (sec: number) => nowSeconds() + sec;

/** Build claims for access tokens. */
export function buildAccessClaims(app: AppClaims, ttlSec: number): TokenClaims {
  return {
    sub: app.userId,
    aud: "FamilyNet",
    iat: nowSeconds(),
    exp: inSeconds(ttlSec),
    ...app,
  };
}

/** Build claims for refresh tokens. */
export function buildRefreshClaims(app: AppClaims, days = 30, jti: string): TokenClaims {
  return {
    iss: process.env.JWT_ISSUER,
    sub: app.userId,
    aud: "refresh",
    iat: nowSeconds(),
    exp: inSeconds(days * 24 * 60 * 60),
    jti,
    ...app,
  };
}
