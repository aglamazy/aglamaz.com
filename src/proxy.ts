import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddleware, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { findBestSupportedLocale, parseAcceptLanguage } from '@/utils/locale';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);
const FALLBACK_LOCALE = SUPPORTED_LOCALES[0] || 'en';

// Helper to add locale header to response
function addLocaleHeader(response: NextResponse, request: NextRequest): NextResponse {
  const locale = request.nextUrl.searchParams.get('locale');
  if (locale) {
    response.headers.set('x-locale', locale);
  }
  return response;
}

// Paths that should get locale prefixes (e.g., / -> /en, /blog -> /en/blog)
const LOCALIZED_PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/contact',
  '/blog',
  '/terms',
];

// All public paths (accessible without auth)
const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/locales',
  '/auth/gate',
  '/auth',
  '/app',
  '/blog',
  '/sitemap.xml',
  '/robots.txt',
  '/terms',
];

const PUBLIC_REDIRECT_PATHS = ['/auth/login'];

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
  const acceptLanguage = request.headers.get('accept-language');
  const preferences = parseAcceptLanguage(acceptLanguage);
  return findBestSupportedLocale(preferences, SUPPORTED_LOCALES) ?? FALLBACK_LOCALE;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale: localeFromPath, path: normalizedPath } = stripLocale(pathname);
  const preferredLocale = localeFromPath ?? resolvePreferredLocale(request);
  const isLocalized = Boolean(localeFromPath);

  if (!isLocalized && isLocalizedPublic(normalizedPath)) {
    const targetLocale = preferredLocale;
    const destination = normalizedPath === '/'
      ? `/${targetLocale}`
      : `/${targetLocale}${normalizedPath}`;
    const redirectUrl = new URL(destination + search, request.url);
    return NextResponse.redirect(redirectUrl, 308);
  }

  const token = request.cookies.get(ACCESS_TOKEN)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'));

  // Allow public paths regardless of auth status
  if (isPublic) {
    return addLocaleHeader(NextResponse.next(), request);
  }

  const isApi = pathname.startsWith('/api');

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (middleware)' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL('/auth/gate', request.url));
  }

  try {
    const claims = await verifyAccessToken(token);
    const needsCredentialSetup = Boolean((claims as any)?.needsCredentialSetup);
    const isCredentialPage = pathname === '/auth/welcome/credentials' || pathname.startsWith('/auth/welcome/credentials/');
    const isCredentialApi = pathname.startsWith('/api/auth/credentials');
    const isLogoutApi = pathname === '/api/auth/logout';

    if (!needsCredentialSetup && isCredentialPage) {
      return NextResponse.redirect(new URL('/app', request.url));
    }

    if (needsCredentialSetup) {
      if (isApi) {
        if (isCredentialApi || isLogoutApi) {
          return addLocaleHeader(NextResponse.next(), request);
        }
        return NextResponse.json({ error: 'Credentials setup required' }, { status: 403 });
      }

      if (!isCredentialPage && !pathname.startsWith('/auth/invite')) {
        return NextResponse.redirect(new URL('/auth/welcome/credentials', request.url));
      }
    }

    if (PUBLIC_REDIRECT_PATHS.includes(normalizedPath)) {
      const target = needsCredentialSetup ? '/auth/welcome/credentials' : '/app';
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (!isPublic) {
      // Resolve siteId from domain
      const { resolveSiteId } = await import('@/utils/resolveSiteId');
      const siteId = await resolveSiteId();

      if (!siteId) {
        // No site configured, redirect to under construction or error page
        return NextResponse.redirect(new URL('/', request.url));
      }

      const res = await apiFetchFromMiddleware(request, `/api/site/${siteId}/member-info`);

      if (res instanceof NextResponse) {
        return res;
      }

      if (!res.ok) {
        return addLocaleHeader(NextResponse.next(), request);
      }

      const memberRes = await res.json();
      const ok =
        memberRes?.success &&
        memberRes?.member &&
        ['member', 'admin'].includes(memberRes.member.role);
      if (!ok) {
        return addLocaleHeader(NextResponse.next(), request);
      }
    }

    return addLocaleHeader(NextResponse.next(), request);
  } catch {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized (api)' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/auth/gate';

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
