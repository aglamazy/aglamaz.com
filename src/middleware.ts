import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddleware, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/locales',
  '/auth-gate',
  '/app',
  '/blog/family',
  '/blog/author',
  '/invite',
  '/sitemap.xml',
  '/robots.txt',
  '/terms',
];

const PUBLIC_REDIRECT_PATHS = ['/', '/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN)?.value;
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  // Only skip auth for public paths when no token is present
  if (!token && isPublic) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api');

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (middleware)' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL('/auth-gate', request.url));
  }

  try {
    const claims = await verifyAccessToken(token);
    const needsCredentialSetup = Boolean((claims as any)?.needsCredentialSetup);
    const isCredentialPage = pathname === '/welcome/credentials' || pathname.startsWith('/welcome/credentials/');
    const isCredentialApi = pathname.startsWith('/api/auth/credentials');
    const isLogoutApi = pathname === '/api/auth/logout';

    if (!needsCredentialSetup && isCredentialPage) {
      return NextResponse.redirect(new URL('/app', request.url));
    }

    if (needsCredentialSetup) {
      if (isApi) {
        if (isCredentialApi || isLogoutApi) {
          return NextResponse.next();
        }
        return NextResponse.json({ error: 'Credentials setup required' }, { status: 403 });
      }

      if (!isCredentialPage && !pathname.startsWith('/invite')) {
        return NextResponse.redirect(new URL('/welcome/credentials', request.url));
      }
    }

    if (PUBLIC_REDIRECT_PATHS.includes(pathname)) {
      const target = needsCredentialSetup ? '/welcome/credentials' : '/app';
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (!isPublic) {
      const siteId = process.env.NEXT_SITE_ID!;
      const res = await apiFetchFromMiddleware(request, `/api/user/member-info?siteId=${siteId}`);

      if (res instanceof NextResponse) {
        return res;
      }

      if (!res.ok) {
        return NextResponse.next();
      }

      const memberRes = await res.json();
      const ok =
        memberRes?.success &&
        memberRes?.member &&
        ['member', 'admin'].includes(memberRes.member.role);
      if (!ok) {
        return NextResponse.next();
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
