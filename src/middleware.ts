import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // Allow access to /login and static files
  if (
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // If not logged in, redirect to /login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Otherwise, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|_next/static|_next/image|favicon.ico).*)',
  ],
};
