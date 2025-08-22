import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken, rotateRefreshToken } from '@/auth/service';
import { setAuthCookies, REFRESH_TOKEN } from '@/auth/cookies';
import { refreshRateLimit } from '@/auth/refresh-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_TOKEN)?.value;
  if (!token) {
    console.error('Missing refresh token');
    return NextResponse.json({ error: 'Unauthorized (refresh, nt)' }, { status: 401 });
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    console.error('Refresh token invalid or reuse detected');
    return NextResponse.json({ error: 'Unauthorized (refresh)' }, { status: 401 });
  }

  const now = Date.now();

  const access = signAccessToken(payload);
  const newRefresh = rotateRefreshToken(payload);

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, access, newRefresh);
  return res;
}
