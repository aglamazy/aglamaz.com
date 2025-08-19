// src/Entities/Token
import { randomBytes } from "crypto";

export interface JwtRegisteredClaims {
  iss?: string;                 // issuer
  sub?: string;                 // subject (usually the user id)
  aud?: string | string[];      // audience
  exp?: number;                 // expiration time (NumericDate = seconds since epoch)
  nbf?: number;                 // not before (NumericDate)
  iat?: number;                 // issued at (NumericDate)
  jti?: string;                 // JWT ID (unique token identifier)
}

export interface AppClaims {
  userId: string;               // you can mirror this to `sub` when signing
  siteId: string;
  role: string;
  firstName: string;
  lastName?: string;
}

export type IToken = JwtRegisteredClaims & AppClaims;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const inSeconds  = (sec: number) => nowSeconds() + sec;

export function buildAccessClaims(app: AppClaims, ttlSec: number): IToken {
  return {
    // RFC claims
    // iss: "https://your-issuer.example",   // optional but recommended
    sub: app.userId,                      // map your userId to standard `sub`
    aud: "FamilyNet",                      // string or array
    iat: nowSeconds(),
    exp: inSeconds(ttlSec),

    // app claims
    ...app,
  };
}

export function buildRefreshClaims(app: AppClaims, days = 30): IToken {
  const jti = randomBytes(16).toString("hex");
  return {
    iss: "https://your-issuer.example",
    sub: app.userId,
    aud: "your-api",
    iat: nowSeconds(),
    exp: inSeconds(days * 24 * 60 * 60),
    jti,                                  // unique ID for revocation

    ...app,
  };
}