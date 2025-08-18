import { ACCESS_TOKEN } from "@/constants";
import { apiFetchFromMiddlewareJSON, verifyAccessToken } from 'src/lib/edgeAuth'
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/pending-member',
  '/locales'
];

export async function middleware(request: NextRequest) {
  console.log("in middleware");
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

    if (path !== '/pending-member') {
      const siteId = process.env.NEXT_SITE_ID;
      const memberRes = await apiFetchFromMiddlewareJSON(request, `/api/user/member-info?siteId=${siteId}`);
      console.log(memberRes);
      if (!(memberRes.success && memberRes.member && ['member', 'admin'].includes(memberRes.member.role))) {
        console.log("failed", memberRes)
        return NextResponse.redirect(new URL('/pending-member', request.url));
      }
    }
  } catch (error) {
    console.error(`middleware error, accessing ${path}`, error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
  console.log("we are cool");
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
