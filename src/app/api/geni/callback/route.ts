import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, GENI_ACCESS, GENI_REFRESH, GENI_STATE, getOrigin } from '@/integrations/geni';

async function handleCallback(req: NextRequest, method: 'GET' | 'POST') {
  try {
    const url = new URL(req.url);
    // Support either GET (query) or POST (form)
    let code = url.searchParams.get('code');
    let state = url.searchParams.get('state');
    let expiresIn = url.searchParams.get('expires_in');

    console.log(`${code} ${method} ${state}`)
    if (method === 'POST') {
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/x-www-form-urlencoded')) {
        const bodyText = await req.text();
        const form = new URLSearchParams(bodyText);
        code = code || form.get('code');
        state = state || form.get('state');
        expiresIn = expiresIn || form.get('expires_in');
      }
    }

    const storedState = req.cookies.get(GENI_STATE)?.value;

    // Log activation (redact sensitive values)
    const redactedCode = code ? `${code.slice(0, 4)}…${code.slice(-4)}` : null;
    console.log('[GENI] Callback hit', {
      method,
      url: req.url,
      hasStoredState: Boolean(storedState),
      stateMatch: Boolean(state && storedState && state === storedState),
      code: redactedCode,
      expiresIn,
    });

    if (!code || !state || !storedState || state !== storedState) {
      console.warn('[GENI] Invalid state or missing code', { hasCode: Boolean(code), state, storedState });
      return NextResponse.redirect(new URL('/', getOrigin(req)), 303);
    }

    const origin = getOrigin(req);
    const token = await exchangeCodeForToken(code, origin);

    // Log non-sensitive result info
    console.log('[GENI] Token exchange ok', {
      hasAccess: Boolean(token?.access_token),
      hasRefresh: Boolean(token?.refresh_token),
      expiresIn: token?.expires_in,
      tokenType: token?.token_type,
    });

    const res = NextResponse.redirect(new URL('/app/geni', origin), 303);
    res.cookies.set(GENI_ACCESS, token.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: Math.max(60, (token.expires_in ?? 3600) - 30),
    });
    if (token.refresh_token) {
      res.cookies.set(GENI_REFRESH, token.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    res.cookies.set(GENI_STATE, '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('[GENI] Callback error', err);
    const origin = getOrigin(req);
    return NextResponse.redirect(new URL('/app/geni?error=oauth', origin), 303);
  }
}

export async function GET(req: NextRequest) {
  return handleCallback(req, 'GET');
}

export async function POST(req: NextRequest) {
  return handleCallback(req, 'POST');
}
