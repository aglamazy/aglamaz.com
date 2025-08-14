import { NextRequest, NextResponse } from 'next/server';
import { signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = req.cookies.get('oauth_state')?.value;
    const codeVerifier = req.cookies.get('pkce_verifier')?.value;

    if (!code || !state || state !== storedState || !codeVerifier) {
      console.error('OAuth callback state mismatch');
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }

    const tokenRes = await fetch(process.env.OAUTH_TOKEN_URL || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.OAUTH_CLIENT_ID || '',
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed');
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }

    const tokenJson = await tokenRes.json();
    const userId = tokenJson.user_id || tokenJson.sub || 'user';

    const access = signAccessToken({ sub: userId });
    const refresh = signRefreshToken({ sub: userId });

    const res = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    setAuthCookies(res, access, refresh);
    res.cookies.set('oauth_state', '', { path: '/', maxAge: 0 });
    res.cookies.set('pkce_verifier', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('OAuth callback error', err);
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  }
}
