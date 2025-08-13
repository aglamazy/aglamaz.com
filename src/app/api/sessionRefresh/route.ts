import { NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';

initAdmin();

const MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (!idToken) {
    return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
  }
  try {
    const auth = adminAuth();
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: MAX_AGE });
    const decoded = await auth.verifyIdToken(idToken);
    const res = NextResponse.json({ status: 'refreshed', user: { ...decoded, user_id: decoded.uid } });
    res.cookies.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE / 1000,
      path: '/',
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
  }
}
