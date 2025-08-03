import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {jwtDecode} from "jwt-decode";

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

  // 2) Check if token is not expired
  const token = request.cookies.get('token')?.value;

  // 3) If not logged in, redirect to /login (avoid loop)
  if (!token) {
    if (path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // 4) check that the token wasn't expired
  const decoded = jwtDecode<{ exp: number }>(token);
  const currentTime = Math.floor(Date.now() / 1000);

  if (decoded.exp < currentTime) {
    // Token expired
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
      'Authorization': `Bearer ${token}`,
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
