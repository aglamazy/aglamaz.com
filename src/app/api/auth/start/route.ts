import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const authUrl = new URL(process.env.OAUTH_AUTHORIZE_URL || '');
  authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID || '');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`);
  authUrl.searchParams.set('scope', process.env.OAUTH_SCOPE || '');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set('oauth_state', state, { httpOnly: true, secure: true, path: '/', maxAge: 300 });
  res.cookies.set('pkce_verifier', codeVerifier, { httpOnly: true, secure: true, path: '/', maxAge: 300 });
  return res;
}
