import { NextResponse } from 'next/server';
const isProd = process.env.NODE_ENV === 'production';

export const ACCESS_TOKEN = 'access_token';
export const REFRESH_TOKEN = 'refresh_token';
const AccessMinutes = 120;
const RefreshDays = 30;

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
