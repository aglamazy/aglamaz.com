import 'server-only';
import type { NextRequest } from 'next/server';

const GENI_BASE = 'https://www.geni.com';
const AUTH_URL = `${GENI_BASE}/platform/oauth/authorize`;
const TOKEN_URL = `${GENI_BASE}/platform/oauth/token`;
const ME_URL = `${GENI_BASE}/api/user`;
const PROFILE_FAMILY_PATH = (guid: string) => `${GENI_BASE}/api/profile-g${guid}/immediate-family`;

export const GENI_ACCESS = 'geni_access';
export const GENI_REFRESH = 'geni_refresh';
export const GENI_STATE = 'geni_state';

export function requireGeniEnv() {
  const key = process.env.GENI_KEY;
  const secret = process.env.GENI_SECRET;
  if (!key || !secret) {
    throw new Error(`GENI_KEY/GENI_SECRET are required.`);
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
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GENI me failed: ${res.status} ${text}`);
  }
  return (await res.json()) as any;
}

export async function fetchGeniImmediateFamily(accessToken: string, guid: string) {
  const url = PROFILE_FAMILY_PATH(guid);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GENI immediate family failed: ${res.status} ${text}`);
  }
  return (await res.json()) as any;
}

export async function fetchGeniFocusGuid(accessToken: string): Promise<string | null> {
  const me = await fetchGeniMe(accessToken);
  // Try several shapes to locate a profile GUID
  let guid: string | null = null;
  const fx = me?.focus;
  if (typeof fx === 'string') {
    // e.g., 'profile-1234' or 'profile-g1234'
    const m = fx.match(/profile-?g?([A-Za-z0-9]+)/);
    if (m) guid = m[1];
  } else if (fx && typeof fx === 'object') {
    guid = fx.guid || fx.id || null;
  }
  if (!guid) {
    // Some responses may put current profile under person or user
    guid = me?.person?.guid || me?.user?.guid || me?.guid || null;
  }
  return guid ? String(guid) : null;
}

export function getOrigin(req: NextRequest) {
  const envOrigin = process.env.NEXT_PUBLIC_BASE_URL;
  if (envOrigin) return envOrigin.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}
