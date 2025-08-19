// src/lib/auth.ts
import { createHash, randomBytes, createSign, createVerify } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import { IToken } from "@/entities/Token";


// In-memory store for hashed refresh tokens and last refresh timestamps
const refreshStore = new Map<string, string>();
const refreshRateLimit = new Map<string, number>();

function base64url(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: IToken, expiresInSec: number): string {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  if (!privateKey) throw new Error('JWT_PRIVATE_KEY not set');
  const header = { alg: 'RS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = { ...payload, exp };
  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(body));
  const unsigned = `${headerEncoded}.${payloadEncoded}`;
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(privateKey);
  const signatureEncoded = base64url(signature);
  return `${unsigned}.${signatureEncoded}`;
}

function verifyJwt(token: string): IToken | null {
  try {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) throw new Error('JWT_PUBLIC_KEY not set');
    const [h, p, s] = token.split('.');
    const verify = createVerify('RSA-SHA256');
    verify.update(`${h}.${p}`);
    const signature = Buffer.from(s, 'base64');
    if (!verify.verify(publicKey, signature)) return null;
    const payload: IToken = JSON.parse(Buffer.from(p, 'base64').toString());
    const skew = 5;
    if (payload.exp < Math.floor(Date.now() / 1000) - skew) return null;
    return payload;
  } catch (err) {
    console.error('JWT verification failed', err);
    return null;
  }
}

export function signAccessToken(tokenDetails: IToken, min : number = 5) {
  return signJwt(tokenDetails, 60 * min);
}

export function signRefreshToken(tokenPayload: IToken, days: number = 30) {
  const jti = randomBytes(16).toString('hex');
  const token = signJwt({ ...tokenPayload, jti }, 60 * 60 * 24 * days);
  refreshStore.set(tokenPayload.userId, hashToken(token));
  return token;
}

export function verifyAccessToken(token: string) {
  return verifyJwt(token);
}

export function verifyRefreshToken(token: string) {
  const payload = verifyJwt(token);
  if (!payload?.sub) return null;
  const hashed = hashToken(token);
  const stored = refreshStore.get(payload.sub);
  if (stored !== hashed) {
    // Reuse detection
    refreshStore.delete(payload.sub);
    return null;
  }
  return payload;
}

export function rotateRefreshToken(tokenPayload: IToken) {
  return signRefreshToken(tokenPayload);
}

export function revokeRefreshToken(userId: string) {
  refreshStore.delete(userId);
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function setAuthCookies(res: NextResponse, access: string, refresh?: string) {
  res.cookies.set(ACCESS_TOKEN, access, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'lax',
  });
  if (refresh) {
    res.cookies.set(REFRESH_TOKEN, refresh, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'lax',
    });
  }
}

export function clearAuthCookies(res: NextResponse) {
  const opts = { path: '/', maxAge: 0 };
  res.cookies.set(ACCESS_TOKEN, '', opts);
  res.cookies.set(REFRESH_TOKEN, '', opts);
}

export { refreshRateLimit };
