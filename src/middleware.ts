import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const path = request.nextUrl.pathname;

  // Allow access to /login, /contact, and static files
  if (
    path.startsWith('/login') ||
    path.startsWith('/contact') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico')
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
    '/((?!login|contact|_next/static|_next/image|favicon.ico).*)',
  ],
};
