import type { NextRequest } from 'next/server';

const GENI_BASE = 'https://www.geni.com';
const AUTH_URL = `${GENI_BASE}/platform/oauth/authorize`;
const TOKEN_URL = `${GENI_BASE}/platform/oauth/token`;
const ME_URL = `${GENI_BASE}/api/user`;

export const GENI_ACCESS = 'geni_access';
export const GENI_REFRESH = 'geni_refresh';
export const GENI_STATE = 'geni_state';

export function requireGeniEnv() {
  const key = process.env.GENI_KEY;
  const secret = process.env.GENI_SECRET;
  if (!key || !secret) {
    throw new Error('GENI_KEY/GENI_SECRET are required');
  }
  return { key, secret } as const;
}

export function getRedirectUri(origin: string) {
  return `${origin}/api/geni/callback`;
}

export function createAuthUrl(origin: string, state: string) {
  const { key } = requireGeniEnv();
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', key);
  url.searchParams.set('redirect_uri', getRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  // Leave scope default per Geni docs; add if needed.
  return url.toString();
}

export async function exchangeCodeForToken(code: string, origin: string) {
  const { key, secret } = requireGeniEnv();
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', key);
  body.set('client_secret', secret);
  body.set('code', code);
  body.set('redirect_uri', getRedirectUri(origin));

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GENI token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
  };
}

export async function fetchGeniMe(accessToken: string) {
  const res = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GENI me failed: ${res.status} ${text}`);
  }
  return (await res.json()) as any;
}

export function getOrigin(req: NextRequest) {
  const envOrigin = process.env.NEXT_PUBLIC_BASE_URL;
  if (envOrigin) return envOrigin.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}
