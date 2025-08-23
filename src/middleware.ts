import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddleware, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';
import { landingPage } from "@/app/settings";

const PUBLIC_PATHS = [
  landingPage,
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/pending-member',
  '/locales',
  '/auth-gate',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isPublic) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api');

  const token = request.cookies.get(ACCESS_TOKEN)?.value;
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (middleware)' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL('/auth-gate', request.url));
  }

  try {
    await verifyAccessToken(token);

    if (pathname !== '/pending-member') {
      const siteId = process.env.NEXT_SITE_ID!;
      const res = await apiFetchFromMiddleware(request, `/api/user/member-info?siteId=${siteId}`);

      if (res instanceof NextResponse) {
        return res;
      }

      if (res.status === 404) {
        return NextResponse.redirect(new URL('/pending-member', request.url));
      }

      if (!res.ok) {
        throw new Error(`Request failed ${res.status} ${res.statusText}`);
      }

      const memberRes = await res.json();
      const ok = memberRes?.success && memberRes?.member && ['member', 'admin'].includes(memberRes.member.role);
      if (!ok) {
        return NextResponse.redirect(new URL('/pending-member', request.url));
      }
    }

    return NextResponse.next();
  } catch {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (api)' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/auth-gate';

    const headers = new Headers(request.headers);
    headers.set('x-auth-gate', '1');

    return NextResponse.rewrite(url, { request: { headers } });
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
