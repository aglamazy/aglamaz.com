import './globals.css';
import I18nProvider from '../components/I18nProvider';
import I18nGate from '../components/I18nGate';
import { fetchSiteInfo } from '../firebase/admin';
import { resolveSiteId } from '../utils/resolveSiteId';
import { getPlatformName } from '../utils/platformName';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, DEFAULT_RESOURCES, SUPPORTED_LOCALES } from '../i18n';
import {
  findBestMatchingTag,
  findBestSupportedLocale,
  parseAcceptLanguage,
  sanitizeLocaleCandidate,
} from '@/utils/locale';
import { getMemberFromToken } from '@/utils/serverAuth';

const GOOGLE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || '';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteInfo = await fetchSiteInfo(undefined, DEFAULT_LOCALE);
    const siteName = siteInfo?.name?.trim();

    return {
      title: siteName ? {
        default: siteName,
        template: `%s | ${siteName}`,
      } : undefined,
      icons: {
        icon: '/favicon.svg',
      },
      verification: {
        google: GOOGLE_VERIFICATION,
      },
    };
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    // Return default metadata instead of throwing
    return {
      title: {
        default: getPlatformName(null),
        template: `%s | ${getPlatformName(null)}`,
      },
      icons: {
        icon: '/favicon.svg',
      },
    };
  }
}

interface RequestLocaleResult {
  base: string;
  full: string;
}

function resolveRequestUrl(rawUrl: string | null): URL {
  if (!rawUrl) {
    return new URL('/', 'http://localhost');
  }

  try {
    return rawUrl.startsWith('http') ? new URL(rawUrl) : new URL(rawUrl, 'http://localhost');
  } catch {
    return new URL('/', 'http://localhost');
  }
}

async function resolveInitialLocale(
  siteId: string | null,
  memberDefaultLocale: string | null | undefined
): Promise<RequestLocaleResult> {
  const headerStore = await headers();
  const rawNextUrl = headerStore.get('next-url');
  const requestUrl = resolveRequestUrl(rawNextUrl);
  const pathname = requestUrl.pathname;
  const searchParams = requestUrl.searchParams;
  const acceptLanguage = headerStore.get('accept-language');
  const preferences = parseAcceptLanguage(acceptLanguage);
  const fallbackBase = findBestSupportedLocale(preferences, SUPPORTED_LOCALES) ?? DEFAULT_LOCALE;

  const localeSegmentMatch = pathname.match(/^\/(\w{2})(?:\/|$)/i);
  const pathLocale = localeSegmentMatch
    ? sanitizeLocaleCandidate(localeSegmentMatch[1], SUPPORTED_LOCALES)
    : undefined;

  let baseLocale = pathLocale ?? fallbackBase;
  const needsPrivateLocale = pathname.startsWith('/app') || pathname.startsWith('/admin');

  if (needsPrivateLocale) {
    const queryLocale = sanitizeLocaleCandidate(searchParams.get('locale'), SUPPORTED_LOCALES);
    if (queryLocale) {
      baseLocale = queryLocale;
    } else {
      const memberLocale = sanitizeLocaleCandidate(
        memberDefaultLocale,
        SUPPORTED_LOCALES,
      );
      baseLocale = memberLocale ?? fallbackBase;
    }
  }

  const fullLocale = findBestMatchingTag(preferences, baseLocale) ?? baseLocale;

  return {
    base: baseLocale,
    full: fullLocale,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteId = await resolveSiteId();

  // Fetch member info (will be null if no user is authenticated)
  let memberInfo = null;
  try {
    memberInfo = siteId ? await getMemberFromToken(siteId) : null;
  } catch (error) {
    console.error('Failed to fetch member info:', error);
    // Don't throw - let the app render with null memberInfo
  }

  const { base: initialLocale, full: resolvedFullLocale } = await resolveInitialLocale(siteId, memberInfo?.defaultLocale);
  let siteInfo = null;
  try {
    siteInfo = siteId
      ? await fetchSiteInfo(siteId, initialLocale)
      : await fetchSiteInfo(undefined, initialLocale);
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let the app render with null siteInfo
  }

  const htmlDir = initialLocale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={resolvedFullLocale} dir={htmlDir}>
      <body>
        {/* Inject siteInfo for client-side access */}
        <script
          id="__SITE_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo ?? null)};`,
          }}
        />
        {/* Inject memberInfo for client-side access */}
        <script
          id="__MEMBER_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__MEMBER_INFO__=${JSON.stringify(memberInfo ?? null)};`,
          }}
        />
        <I18nProvider
          initialLocale={initialLocale}
          resolvedLocale={resolvedFullLocale}
          resources={DEFAULT_RESOURCES}
        >
          <I18nGate>{children}</I18nGate>
        </I18nProvider>
      </body>
    </html>
  );
}
