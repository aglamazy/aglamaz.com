import { NextRequest, NextResponse } from 'next/server';
import { initAdmin, adminAuth } from './src/firebase/admin';

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/private')) return NextResponse.next();
  initAdmin();
  const token = req.cookies.get('token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  try {
    await adminAuth().verifyIdToken(token);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
export const config = { matcher: ["/private/:path*"] };
