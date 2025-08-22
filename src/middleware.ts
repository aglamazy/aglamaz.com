import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddlewareJSON, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/pending-member',
  '/locales',
  '/_auth-gate',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isPublic) return NextResponse.next();

  const isApi = pathname.startsWith('/api');

  const token = request.cookies.get(ACCESS_TOKEN)?.value;
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL('/_auth-gate', request.url));
  }

  try {
    await verifyAccessToken(token);

    if (pathname !== '/pending-member') {
      const siteId = process.env.NEXT_SITE_ID!;
      const memberRes = await apiFetchFromMiddlewareJSON(request, `/api/user/member-info?siteId=${siteId}`);
      const ok = memberRes?.success && memberRes?.member && ['member', 'admin'].includes(memberRes.member.role);
      if (!ok) {
        return NextResponse.redirect(new URL('/pending-member', request.url));
      }
    }

    return NextResponse.next();
  } catch {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL('/_auth-gate', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
