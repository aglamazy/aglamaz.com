import './globals.css';
import I18nProvider from '../components/I18nProvider';
import I18nGate from '../components/I18nGate';
import { fetchSiteInfo } from '../firebase/admin';
import { resolveSiteId } from '../utils/resolveSiteId';
import { getPlatformName } from '../utils/platformName';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, DEFAULT_RESOURCES, SUPPORTED_LOCALES } from '../i18n';

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

async function resolveInitialLocale(): Promise<string> {
  const headerStore = await headers();
  const headerLocale = headerStore.get('x-locale');
  if (headerLocale && SUPPORTED_LOCALES.includes(headerLocale)) {
    return headerLocale;
  }
  return DEFAULT_LOCALE;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLocale = await resolveInitialLocale();
  let siteInfo = null;
  try {
    const siteId = await resolveSiteId();
    siteInfo = siteId ? await fetchSiteInfo(siteId, initialLocale) : await fetchSiteInfo(undefined, initialLocale);
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let the app render with null siteInfo
  }

  const htmlDir = initialLocale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={initialLocale} dir={htmlDir}>
      <body>
        {/* Inject siteInfo for client-side access */}
        <script
          id="__SITE_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo ?? null)};`,
          }}
        />
        <I18nProvider initialLocale={initialLocale} resources={DEFAULT_RESOURCES}>
          <I18nGate>{children}</I18nGate>
        </I18nProvider>
      </body>
    </html>
  );
}
