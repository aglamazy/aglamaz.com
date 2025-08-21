import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddlewareJSON, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/pending-member',
  '/locales'
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await verifyAccessToken(token);

    if (path !== '/pending-member') {
      const siteId = process.env.NEXT_SITE_ID;
      const memberRes = await apiFetchFromMiddlewareJSON(request, `/api/user/member-info?siteId=${siteId}`);
      if (!(memberRes.success && memberRes.member && ['member', 'admin'].includes(memberRes.member.role))) {
        return NextResponse.redirect(new URL('/pending-member', request.url));
      }
    }
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
