import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddleware, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);
const FALLBACK_LOCALE = SUPPORTED_LOCALES[0] || 'en';

// Paths that should get locale prefixes (e.g., / -> /en, /blog -> /en/blog)
const LOCALIZED_PUBLIC_PATHS = [
  '/',
  '/login',
  '/contact',
  '/blog',
  '/blog/family',
  '/blog/author',
  '/terms',
];

// All public paths (accessible without auth)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/locales',
  '/auth-gate',
  '/app',
  '/blog',
  '/blog/family',
  '/blog/author',
  '/invite',
  '/sitemap.xml',
  '/robots.txt',
  '/terms',
];

const PUBLIC_REDIRECT_PATHS = ['/', '/login'];

function stripLocale(pathname: string) {
  const match = pathname.match(/^\/(\w{2})(\/.*)?$/);
  if (match && SUPPORTED_LOCALES.includes(match[1])) {
    const rest = (match[2] || '').replace(/^\/+/, '');
    return {
      locale: match[1],
      path: rest ? `/${rest}` : '/',
    };
  }
  return { locale: null, path: pathname || '/' };
}

function isLocalizedPublic(path: string) {
  return LOCALIZED_PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function resolvePreferredLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }
  return FALLBACK_LOCALE;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale: localeFromPath, path: normalizedPath } = stripLocale(pathname);
  const preferredLocale = localeFromPath ?? resolvePreferredLocale(request);
  const isLocalized = Boolean(localeFromPath);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', preferredLocale);

  if (!isLocalized && isLocalizedPublic(normalizedPath)) {
    const targetLocale = preferredLocale;
    const destination = normalizedPath === '/'
      ? `/${targetLocale}`
      : `/${targetLocale}${normalizedPath}`;
    const redirectUrl = new URL(destination + search, request.url);
    const response = NextResponse.redirect(redirectUrl, 308);
    response.cookies.set('NEXT_LOCALE', targetLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  const token = request.cookies.get(ACCESS_TOKEN)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'));

  // Allow public paths regardless of auth status
  if (isPublic) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isApi = pathname.startsWith('/api');

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (middleware)' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL('/auth-gate', request.url), {
      request: { headers: requestHeaders },
    });
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

    if (PUBLIC_REDIRECT_PATHS.includes(normalizedPath)) {
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

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (api)' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/auth-gate';

    const headers = new Headers(request.headers);
    headers.set('x-auth-gate', '1');
    headers.set('x-locale', preferredLocale);

    return NextResponse.rewrite(url, { request: { headers } });
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
