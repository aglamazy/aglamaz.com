import { ACCESS_TOKEN } from '@/auth/cookies';
import { apiFetchFromMiddleware, verifyAccessToken } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { findBestSupportedLocale, parseAcceptLanguage } from '@/utils/locale';
import { AppRoute, getPath } from '@/utils/urls';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);
const FALLBACK_LOCALE = SUPPORTED_LOCALES[0] || 'en';

// Forwards ?locale= as an x-locale REQUEST header so Server Components (which read it via
// headers()) can see it. Setting it on a NextResponse.next()'s own .headers only decorates the
// outgoing HTTP response and never reaches the downstream request — it must go through the
// `request: { headers }` override for Next.js to inject it as x-middleware-request-x-locale.
function withLocaleHeader(request: NextRequest): NextResponse {
  const locale = request.nextUrl.searchParams.get('locale');
  if (!locale) {
    return NextResponse.next();
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Paths that should get locale prefixes (e.g., / -> /en, /blog -> /en/blog)
const LOCALIZED_PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/contact',
  '/blog',
  '/terms',
  '/privacy',
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
  '/privacy',
  '/og',
  '/public',
];

const PUBLIC_REDIRECT_PATHS = ['/auth/login'];

// API routes that are deliberately reachable with no session (see the route
// handler's own comment) — the non-member memorial-page write path. Matched
// by pattern rather than folded into PUBLIC_PATHS since that's a plain
// prefix list and would otherwise expose the rest of /api/site/*.
const PUBLIC_API_PATTERNS = [
  /^\/api\/site\/[^/]+\/blessing-pages\/[^/]+\/blessings\/public$/,
];

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PATTERNS.some((re) => re.test(pathname));
}

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

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale: localeFromPath, path: normalizedPath } = stripLocale(pathname);

  // Device-sensitive redirect: /app/slideshow → mobile /app, desktop /app/photos?slideshow=1
  if (normalizedPath === getPath(AppRoute.APP_SLIDESHOW)) {
    const ua = request.headers.get('user-agent') || '';
    const target = MOBILE_UA_RE.test(ua)
      ? getPath(AppRoute.APP_DASHBOARD)
      : '/app/photos?slideshow=1';
    return NextResponse.redirect(new URL(target, request.url));
  }
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
  const isPublic = PUBLIC_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'))
    || isPublicApiPath(normalizedPath);

  // Allow public paths regardless of auth status
  if (isPublic) {
    return withLocaleHeader(request);
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
          return withLocaleHeader(request);
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
        return withLocaleHeader(request);
      }

      const memberRes = await res.json();
      const ok =
        memberRes?.success &&
        memberRes?.member &&
        ['member', 'admin'].includes(memberRes.member.role);
      if (!ok) {
        return withLocaleHeader(request);
      }
    }

    return withLocaleHeader(request);
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
