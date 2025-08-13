import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { initAdmin, adminAuth } from '@/firebase/admin';

initAdmin();

export async function POST() {
  const cookieStore = cookies();
  const session = cookieStore.get('session')?.value;
  if (session) {
    try {
      const decoded = await adminAuth().verifySessionCookie(session);
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch (e) {
      // ignore errors
    }
  }
  const res = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  res.cookies.set('session', '', { path: '/', maxAge: 0 });
  return res;
}
