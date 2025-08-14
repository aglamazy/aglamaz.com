import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, revokeRefreshToken, clearAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('refresh_token')?.value;
  if (token) {
    const payload = verifyRefreshToken(token);
    if (payload) {
      revokeRefreshToken(payload.sub);
    }
  }
  const res = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  clearAuthCookies(res);
  return res;
}
