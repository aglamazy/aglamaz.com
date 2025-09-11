import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, GENI_ACCESS, GENI_REFRESH, GENI_STATE, getOrigin } from '@/integrations/geni';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = req.cookies.get(GENI_STATE)?.value;
    if (!code || !state || !storedState || state !== storedState) {
      return NextResponse.redirect(new URL('/', getOrigin(req)), 303);
    }

    const origin = getOrigin(req);
    const token = await exchangeCodeForToken(code, origin);

    const res = NextResponse.redirect(new URL('/geni', origin), 303);
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
    console.error('GENI callback error:', err);
    // Redirect back with error so UI can show a message
    const origin = getOrigin(req);
    return NextResponse.redirect(new URL('/geni?error=oauth', origin), 303);
  }
}
