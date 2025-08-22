import { NextRequest, NextResponse } from 'next/server';
import { signAccessToken, signRefreshToken } from '@/auth/service';
import { setAuthCookies } from '@/auth/cookies';
import { FamilyRepository } from "@/repositories/FamilyRepository";
import { landingPage } from "@/app/settings";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = req.cookies.get('oauth_state')?.value;
    const codeVerifier = req.cookies.get('pkce_verifier')?.value;

    if (!code || !state || state !== storedState || !codeVerifier) {
      console.error('OAuth callback state mismatch');
      return NextResponse.redirect(new URL(landingPage, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
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
      return NextResponse.redirect(new URL(landingPage, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }

    const tokenJson = await tokenRes.json();
    const familyRepository = new FamilyRepository();
    const userId = tokenJson.user_id || tokenJson.sub || 'user';
    const memberDetails = await familyRepository.getMemberByUserId(userId, process.env.familyRepository);

    const tokenDetails = {
      userId,
      siteId: process.env.NEXT_SITE_ID,
      role: memberDetails.role,
      firstName: memberDetails.firstName,
      lastName: memberDetails.lastName,
    };
    const access = signAccessToken(tokenDetails);
    const refresh = signRefreshToken(tokenDetails);

    const res = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    setAuthCookies(res, access, refresh);
    res.cookies.set('oauth_state', '', { path: '/', maxAge: 0 });
    res.cookies.set('pkce_verifier', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('OAuth callback error', err);
    return NextResponse.redirect(new URL(landingPage, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  }
}
