import { ACCESS_TOKEN, RT_SESSION, RT_SESSION_MAX_AGE_SECONDS } from '@/auth/cookies';
import { apiFetchFromMiddleware, verifyAccessToken, verifyReadTokenEdge } from 'src/lib/edgeAuth';
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { findBestSupportedLocale, parseAcceptLanguage } from '@/utils/locale';
import { AppRoute, getPath } from '@/utils/urls';
import nextI18NextConfig from '../next-i18next.config.js';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);
// Was hardcoded to SUPPORTED_LOCALES[0] ('en'), which silently disagreed with
// the app's real configured default (next-i18next.config.js: 'he') - only
// mattered for the rare case of a missing Accept-Language header, but still
// a real inconsistency. Now wired to the same source of truth.
const FALLBACK_LOCALE =
  (typeof nextI18NextConfig?.i18n?.defaultLocale === 'string' ? nextI18NextConfig.i18n.defaultLocale : undefined)
  ?? SUPPORTED_LOCALES[0]
  ?? 'en';

// Search-engine crawlers don't have a real language "preference" the way a
// browser does, but the / -> /{locale} redirect below content-negotiates via
// Accept-Language for real users. Left unguarded, that means Googlebot (whose
// Accept-Language varies between crawl configs/sessions) can land on a
// DIFFERENT locale on different crawls of the same bare URL - search engines
// see that as an inconsistent redirect target, which is exactly what famcircle#115's
// GSC report flagged ("Duplicate, Google chose different canonical than
// user" on /en, "Page with redirect" on /). Bots always get FALLBACK_LOCALE
// instead, so every crawl of a bare public path lands on the same target.
const CRAWLER_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|vkshare|w3c_validator/i;

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
  // Email open/click tracking - token-gated (the signed token is the auth), fetched by mail
  // clients and link clicks with no session cookie at all.
  /^\/api\/track\/pixel\/[^/]+$/,
  /^\/api\/track\/click\/[^/]+$/,
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
  const userAgent = request.headers.get('user-agent') || '';
  if (CRAWLER_UA_RE.test(userAgent)) {
    return FALLBACK_LOCALE;
  }
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

  // famcircle#125: page-level read-only-token auth for /app/* (magazine links w/o login).
  // A signed `rt` token in the URL grants a read-only session with no Firebase Auth cookie —
  // the page-level counterpart to withReadableGuard's API-route pattern
  // (docs/family-digest-formats-spec.md §7). Only fires when there's no real session, so a
  // logged-in user's `rt` param is simply ignored. On success: set the RT_SESSION cookie and
  // redirect to the same path with `rt` stripped (so it doesn't linger in browser history).
  // On failure: fall through unchanged — never a redirect from here, never a 500 — the
  // existing unauthenticated behavior further down (and in the layout) still applies.
  // NOTE: this never grants write access — withMemberGuard/withUserGuard (write routes)
  // never read RT_SESSION or `rt`, by construction.
  if (normalizedPath === '/app' || normalizedPath.startsWith('/app/')) {
    const rt = request.nextUrl.searchParams.get('rt');
    if (rt) {
      // famcircle#138: gating on "token present" rather than "token valid" meant ANY
      // leftover access_token cookie (stale/expired — not just a real active session)
      // silently blocked rt-processing entirely: no redirect, no RT_SESSION, no error.
      // Every visitor who ever logged in carries that cookie, so every weekly-digest
      // magic link silently failed for them while working fine in incognito — which is
      // exactly why this looked unreproducible. Must verify validity, not presence, and
      // fail OPEN to the magic link when the existing cookie turns out to be dead.
      let hasValidAccessToken = false;
      if (token) {
        try {
          await verifyAccessToken(token);
          hasValidAccessToken = true;
        } catch {
          hasValidAccessToken = false;
        }
      }
      if (!hasValidAccessToken) {
        const claims = await verifyReadTokenEdge(rt);
        if (claims) {
          const redirectUrl = new URL(pathname, request.url);
          const response = NextResponse.redirect(redirectUrl);
          response.cookies.set(RT_SESSION, rt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: RT_SESSION_MAX_AGE_SECONDS,
          });
          return response;
        }
      }
    }
  }

  const isPublic = PUBLIC_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'))
    || isPublicApiPath(normalizedPath);

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
