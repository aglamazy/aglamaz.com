import { NextRequest, NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { signAccessToken, signRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    initAdmin();
    const decoded = await adminAuth().verifyIdToken(idToken);
    const access = signAccessToken({ sub: decoded.uid });
    const refresh = signRefreshToken({ sub: decoded.uid });

    const secure = process.env.NODE_ENV === 'production';
    const res = NextResponse.json({ token: access });
    res.cookies.set('refresh_token', refresh, {
      httpOnly: true,
      secure,
      path: '/api/auth/refresh',
      sameSite: 'lax',
    });
    return res;
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
