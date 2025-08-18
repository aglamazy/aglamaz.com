// utils/auth/verifyAccessToken.ts
import { jwtVerify, importSPKI } from 'jose'
import { NextRequest, NextResponse } from 'next/server';

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

export async function apiFetchFromMiddleware(
  req: NextRequest,
  input: string | URL,
  init: RequestInit = {}
): Promise<Response | NextResponse> {
  const origin = req.nextUrl.origin;
  const targetUrl = new URL(typeof input === 'string' ? input : input.toString(), origin);

  const withCookies = {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      cookie: req.headers.get('cookie') ?? '',
    },
  };

  console.log(`target: ${targetUrl}`)
  const res = await fetch(targetUrl, withCookies);
  if (res.status !== 401) return res;

  // Try refresh with FULL URL and forwarded cookies
  const refreshUrl = new URL('/api/auth/refresh', origin);
  const refresh = await fetch(refreshUrl, {
    method: 'POST',
    headers: { cookie: req.headers.get('cookie') ?? '' },
  });

  if (refresh.ok) {
    return fetch(targetUrl, withCookies);
  }

  // Redirect to login in middleware-land
  return NextResponse.redirect(new URL('/login', origin));
}