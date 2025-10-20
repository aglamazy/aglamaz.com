import './globals.css';
import I18nProvider from '../components/I18nProvider';
import I18nGate from '../components/I18nGate';
import { fetchSiteInfo } from '../firebase/admin';
import i18n from '../i18n';
import nextI18NextConfig from '../../next-i18next.config.js';
import type { Metadata } from 'next';

const GOOGLE_VERIFICATION = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();
const DEFAULT_LANG =
  process.env.NEXT_DEFAULT_LANG ||
  (typeof nextI18NextConfig?.i18n?.defaultLocale === 'string'
    ? nextI18NextConfig.i18n.defaultLocale
    : 'en');
const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur']);
const DEFAULT_LANG_BASE = DEFAULT_LANG.split('-')[0]?.toLowerCase() || 'en';
const DEFAULT_DIR = RTL_LANGS.has(DEFAULT_LANG_BASE) ? 'rtl' : 'ltr';

function getBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw.replace(/\/+$/, ''));
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteInfo = await fetchSiteInfo();
    const translations = (siteInfo as any)?.translations as Record<string, string> | undefined;
    const siteName =
      translations?.[DEFAULT_LANG_BASE] ||
      (siteInfo as any)?.name ||
      'FamilyCircle';
    const t = i18n.getFixedT(DEFAULT_LANG_BASE, 'common');
    const description = `${siteName} – ${(t('stayConnected') as string)}`;
    const baseUrl = getBaseUrl();

    const metadata: Metadata = {
      title: {
        default: siteName,
        template: `%s | ${siteName}`,
      },
      description,
      icons: {
        icon: '/favicon.svg',
      },
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: '/',
      },
      openGraph: {
        title: siteName,
        description,
        url: baseUrl ? baseUrl.href : undefined,
        siteName,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: siteName,
        description,
      },
    };

    if (GOOGLE_VERIFICATION) {
      metadata.verification = { google: GOOGLE_VERIFICATION };
    }

    if (baseUrl) {
      metadata.metadataBase = baseUrl;
    }

    return metadata;
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    throw error;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  const baseUrl = getBaseUrl();

  return (
    <html lang={DEFAULT_LANG_BASE} dir={DEFAULT_DIR}>
      <head>{baseUrl ? <link rel="canonical" href={baseUrl.href} /> : null}</head>
      <body>
        {/* Inject siteInfo for client-side access */}
        <script
          id="__SITE_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo || {})};`,
          }}
        />
        <I18nProvider>
          <I18nGate>{children}</I18nGate>
        </I18nProvider>
      </body>
    </html>
  );
}
