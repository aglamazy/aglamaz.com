import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken, rotateRefreshToken } from '@/auth/service';
import { setAuthCookies, REFRESH_TOKEN } from '@/auth/cookies';
import { refreshRateLimit } from '@/auth/refresh-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_TOKEN)?.value;
  if (!token) {
    console.error('Missing refresh token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    console.error('Refresh token invalid or reuse detected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const last = refreshRateLimit.get(payload.sub) || 0;
  if (now - last < 5000) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  refreshRateLimit.set(payload.sub, now);

  const access = signAccessToken(payload);
  const newRefresh = rotateRefreshToken(payload);

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, access, newRefresh);
  return res;
}
