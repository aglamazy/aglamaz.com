import { apiFetch } from "@/utils/apiFetch";
import { ACCESS_TOKEN } from "@/constants";
import { apiFetchFromMiddleware, verifyAccessToken } from 'src/lib/edgeAuth'
import { NextRequest, NextResponse } from 'next/server';

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

    if (path !== '/pending-approval') {
      console.log("check membership")
      const siteId = process.env.NEXT_SITE_ID;
      const memberRes = await apiFetchFromMiddleware(request, `/api/user/member-info?siteId=${siteId}`);
      console.log(memberRes);
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
