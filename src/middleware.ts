import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next', // covers static and image assets
  '/pending-approval'
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow all public paths
  if (PUBLIC_PATHS.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;

  // If not logged in, redirect to /login (avoid loop)
  if (!token) {
    if (path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // If already on /pending-approval, don't check again to avoid loop
  if (path === '/pending-approval') {
    return NextResponse.next();
  }

  // Check membership
  const memberRes = await fetch(`${request.nextUrl.origin}/api/user/member-info`, {
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
