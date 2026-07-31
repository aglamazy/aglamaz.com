// utils/auth/verifyAccessToken.ts
import { jwtVerify, importSPKI } from 'jose'
import { NextRequest, NextResponse } from 'next/server';
import { landingPage } from "@/app/settings";
import { READ_TOKEN_AUDIENCE } from '@/services/ReadTokenService';

const ALG = 'RS256'

// Build-time env is fine in Edge. Keep PEM with literal \n in .env
const PUBLIC_KEY_PEM = process.env.JWT_PUBLIC_KEY
if (!PUBLIC_KEY_PEM) throw new Error('JWT_PUBLIC_KEY not set')

// Cache the parsed CryptoKey across invocations on the same isolate
let cachedKey: CryptoKey | undefined

async function getVerifyKey() {
  if (!cachedKey) {
    const spki = PUBLIC_KEY_PEM.replace(/\\n/g, '\n').trim()
    cachedKey = await importSPKI(spki, ALG)
  }
  return cachedKey
}

export async function verifyJwt<T extends object = Record<string, unknown>>(token: string): Promise<T> {
  try {
    const key = await getVerifyKey()
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALG],
      // Optional: allow small clock skew if needed
      // clockTolerance: '5s',
    })
    return payload as T
  } catch (error) {
    throw error;
  }
}

export function verifyAccessToken<T extends object = Record<string, unknown>>(token: string) {
  return verifyJwt<T>(token)
}

export interface EdgeReadTokenPayload {
  memberId: string;
  siteId: string;
}

/**
 * Edge-runtime-safe counterpart to ReadTokenService.verifyReadToken. Middleware/proxy runs
 * in the Edge runtime, where Node's `crypto` module (used by src/auth/jwt.ts's verifyJwt) is
 * unavailable — same split this file already applies to the main ACCESS_TOKEN (verifyAccessToken
 * above verifies with `jose` against the same RSA public key that src/auth/jwt.ts signs with,
 * rather than re-implementing signing). Same key, same algorithm, same audience — just a
 * different verification library. Returns null on any failure (missing, expired, wrong
 * audience, malformed, site/member claims absent).
 */
export async function verifyReadTokenEdge(token: string): Promise<EdgeReadTokenPayload | null> {
  try {
    const key = await getVerifyKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    if (payload.aud !== READ_TOKEN_AUDIENCE) return null;

    const memberId = (payload as Record<string, unknown>).memberId;
    const siteId = (payload as Record<string, unknown>).siteId;
    if (typeof memberId !== 'string' || !memberId.trim()) return null;
    if (typeof siteId !== 'string' || !siteId.trim()) return null;
    if (payload.sub !== memberId) return null;

    return { memberId, siteId };
  } catch {
    return null;
  }
}

function extractCookieHeader(setCookieHeader: string): string {
  // Turn "a=1; Path=/, b=2; HttpOnly" into "a=1; b=2"
  // Split on commas that start a new cookie (word chars + '=')
  const parts = setCookieHeader.split(/,(?=\s*\w+=)/);
  return parts.map(p => p.split(';')[0].trim()).join('; ');
}

export async function apiFetchFromMiddleware(
  req: NextRequest,
  input: string | URL,
  init: RequestInit = {}
): Promise<Response | NextResponse> {
  const origin = req.nextUrl.origin;
  const targetUrl = new URL(typeof input === 'string' ? input : input.toString(), origin);

  // Don’t attempt to refresh while calling refresh
  if (targetUrl.pathname === '/api/auth/refresh') {
    return fetch(targetUrl, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        cookie: req.headers.get('cookie') ?? '',
      },
    });
  }

  const baseHeaders = (init.headers as Record<string, string> | undefined) ?? {};
  const incomingCookie = req.headers.get('cookie') ?? '';

  const doFetch = (url: URL, cookieHeader: string, initOverride?: RequestInit) =>
    fetch(url, {
      ...init,
      ...initOverride,
      headers: {
        ...baseHeaders,
        cookie: cookieHeader,
        // optionally forward some context
        'accept-language': req.headers.get('accept-language') ?? '',
        'user-agent': req.headers.get('user-agent') ?? '',
      },
    });

  // 1) initial call with incoming cookies
  let res = await doFetch(targetUrl, incomingCookie);

  if (res.status !== 401) return res;

  // 2) try refresh
  const refreshUrl = new URL('/api/auth/refresh', origin);
  const refreshRes = await doFetch(refreshUrl, incomingCookie, { method: 'POST' });

  if (!refreshRes.ok) {
    // refresh failed → redirect to login
    return NextResponse.redirect(new URL(landingPage, origin));
  }

  // 3) capture new cookies and retry original request WITH the refreshed cookies
  const setCookieHeader = refreshRes.headers.get('set-cookie') ?? '';
  if (!setCookieHeader) {
    // no cookies set by refresh → treat as failure
    return NextResponse.redirect(new URL(landingPage, origin));
  }

  const refreshedCookie = extractCookieHeader(setCookieHeader);
  const mergedCookie = [incomingCookie, refreshedCookie].filter(Boolean).join('; ');

  return doFetch(targetUrl, mergedCookie);
}

export async function apiFetchFromMiddlewareJSON<T = any>(
  req: NextRequest,
  input: string | URL,
  init: RequestInit = {}
): Promise<T | NextResponse> {
  const resOrRedirect = await apiFetchFromMiddleware(req, input, init);
  if (resOrRedirect instanceof NextResponse) return resOrRedirect;

  if (!resOrRedirect.ok) {
    throw new Error(`Request failed ${resOrRedirect.status} ${resOrRedirect.statusText}`);
  }

  const ct = resOrRedirect.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await resOrRedirect.json()) as T;
  }
  const text = await resOrRedirect.text();
  return text as unknown as T;
}