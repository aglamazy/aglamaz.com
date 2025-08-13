import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';

initAdmin();

const PUBLIC_PATHS = [
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next', // covers static and image assets
  '/pending-approval',
  '/locales'
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1) Allow all public paths
  if (PUBLIC_PATHS.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'))) {
    return NextResponse.next();
  }

  // 2) Verify session cookie
  const session = request.cookies.get('session')?.value;

  if (!session) {
    if (path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  try {
    await adminAuth().verifySessionCookie(session, true);
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4) If already on /pending-approval, don't check again to avoid loop
  if (path === '/pending-approval') {
    return NextResponse.next();
  }

  // 5) Check membership
  const siteId = process.env.NEXT_SITE_ID;
  const memberRes = await fetch(`${request.nextUrl.origin}/api/user/member-info?siteId=${siteId}`, {
    headers: {
      'Cookie': request.headers.get('cookie') || ''
    }
  });
  if (!memberRes.ok) {
    // Not a member, redirect to /pending-approval (avoid loop)
    if (path !== '/pending-approval') {
      return NextResponse.redirect(new URL('/pending-approval', request.url));
    }
    return NextResponse.next();
  }

  // Otherwise, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
