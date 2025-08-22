import { NextRequest, NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { signAccessToken, signRefreshToken } from '@/auth/service';
import { setAuthCookies } from '@/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    initAdmin();
    const decoded = await adminAuth().verifyIdToken(idToken);
    const appClaims = {
      userId: decoded.uid,
      siteId: process.env.NEXT_SITE_ID || '',
      role: (decoded as any).role || 'member',
      firstName: (decoded as any).name || '',
      lastName: '',
    };
    const accessMin = 10;
    const refreshDays = 30;
    const access = signAccessToken(appClaims, accessMin);
    const refresh = signRefreshToken(appClaims, refreshDays);

    const res = NextResponse.json({ token: access });
    setAuthCookies(res, access, refresh);
    return res;
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Unauthorized (login)' }, { status: 401 });
  }
}
