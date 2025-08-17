import { NextRequest, NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/constants";

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

    res.cookies.set(ACCESS_TOKEN,  '', { path: '/',                     maxAge: 0 });
    res.cookies.set(REFRESH_TOKEN, '', { path: '/api/auth/refresh',     maxAge: 0 });

    res.cookies.set(ACCESS_TOKEN, access, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,                 // 10 minutes
    });

    res.cookies.set(REFRESH_TOKEN, refresh, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 60 * 60 * 24 * 14,       // 14 days
    });

    return res;
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
