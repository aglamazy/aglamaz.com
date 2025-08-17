import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from "@/lib/edgeAuth";
import { ACCESS_TOKEN } from "@/constants";

const PUBLIC_PATHS = [
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/pending-approval',
  '/locales'
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  try {
    const token = request.cookies.get(ACCESS_TOKEN)?.value;
    const payload = token && verifyAccessToken(token);
    if (!payload) {
      if (path !== '/login') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.next();
    }

    // Optional membership check
    if (path !== '/pending-approval') {
      const siteId = process.env.NEXT_SITE_ID;
      const memberRes = await fetch(`${request.nextUrl.origin}/api/user/member-info?siteId=${siteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      if (!memberRes.ok) {
        return NextResponse.redirect(new URL('/pending-approval', request.url));
      }
    }
  } catch (error) {
    console.error(`middleware error, accessing ${path}`, error);
    NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
