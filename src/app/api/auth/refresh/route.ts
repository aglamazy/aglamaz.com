import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken, rotateRefreshToken } from '@/auth/service';
import { setAuthCookies, REFRESH_TOKEN } from '@/auth/cookies';
import { refreshRateLimit } from '@/auth/refresh-store';

export const dynamic = 'force-dynamic';

// Classifies an ALREADY-rejected token so a failed refresh says why (famcircle#179: Android
// Chrome reopen forces a new login and nothing recorded which failure it was). It only
// reads the unverified payload's exp; it never accepts a token.
function classifyRejectedToken(token: string): 'expired' | 'invalid' {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000) ? 'expired' : 'invalid';
  } catch {
    return 'invalid';
  }
}

function failure(req: NextRequest, error: string, reason: 'missing_cookie' | 'expired' | 'invalid') {
  console.error(
    `[refresh] FAIL reason=${reason} cookies=${req.cookies.getAll().length} ua=${req.headers.get('user-agent') ?? 'none'}`
  );
  return NextResponse.json({ error, reason }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_TOKEN)?.value;
  if (!token) {
    return failure(req, 'Unauthorized (refresh, nt)', 'missing_cookie');
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    return failure(req, 'Unauthorized (refresh)', classifyRejectedToken(token));
  }

  const now = Date.now();

  const access = signAccessToken(payload);
  const newRefresh = rotateRefreshToken(payload);

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, access, newRefresh);
  return res;
}
