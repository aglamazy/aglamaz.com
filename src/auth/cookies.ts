import { NextResponse } from 'next/server';
const isProd = process.env.NODE_ENV === 'production';

export const ACCESS_TOKEN = 'access_token';
export const REFRESH_TOKEN = 'refresh_token';
// famcircle#125: page-level read-only-token auth for /app/*. Set by src/proxy.ts once it
// verifies a `?rt=` read-token (docs/family-digest-formats-spec.md §7); read by
// src/app/app/layout.tsx to resolve a read-only member context with no Firebase session.
// Short-lived (1h) and independent of the read-token's own 14-day TTL, since the token
// itself is re-verified from this cookie's raw value on every layout render anyway.
export const RT_SESSION = 'RT_SESSION';
const AccessMinutes = 120;
const RefreshDays = 30;
export const RT_SESSION_MAX_AGE_SECONDS = 60 * 60;

/** Set auth cookies for access and optional refresh tokens. */
export function setAuthCookies(res: NextResponse, access: string, refresh?: string) {
  res.cookies.set(ACCESS_TOKEN, access, {
    httpOnly: true,
    secure: isProd,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * AccessMinutes
  });
  if (refresh) {
    res.cookies.set(REFRESH_TOKEN, refresh, {
      httpOnly: true,
      secure: isProd,
      path: '/api/auth/refresh',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * RefreshDays
    });
  }
}

/** Clear auth cookies. */
export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_TOKEN, '', { path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_TOKEN, '', { path: '/api/auth/refresh', maxAge: 0 });
}
