import { NextRequest, NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/constants";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    initAdmin();
    const decoded = await adminAuth().verifyIdToken(idToken);
    const accessMin = 10;
    const refreshDays = 30;
    const access = signAccessToken({ sub: decoded.uid }, accessMin);
    const refresh = signRefreshToken({ sub: decoded.uid }, refreshDays);

    const secure = process.env.NODE_ENV === 'production';
    const res = NextResponse.json({ token: access });

    res.cookies.set(ACCESS_TOKEN, access, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * accessMin,
    });

    res.cookies.set(REFRESH_TOKEN, refresh, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * refreshDays,       // 14 days
    });

    return res;
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
