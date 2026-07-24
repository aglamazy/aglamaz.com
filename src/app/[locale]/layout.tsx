import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import PublicLayoutShell from '@/components/PublicLayoutShell';
import I18nProvider from '@/components/I18nProvider';
import I18nGate from '@/components/I18nGate';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getPlatformName } from '@/utils/platformName';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { assertSerializableDev } from '@/utils/assertSerializableDev';
import { findBestMatchingTag, parseAcceptLanguage } from '@/utils/locale';

// This layout uses headers() for multi-tenant routing, so it must be dynamic
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

// The root layout's title template is built from a locale-less siteName lookup
// (see src/app/layout.tsx), which always resolves to the app's DEFAULT_LOCALE.
// Every page under [locale] needs its "%s | <site name>" suffix in the locale
// actually being viewed, so we re-derive the template here with the resolved
// locale — this nearer template wins over the root layout's for all descendants.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramsLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramsLocale) ? paramsLocale : DEFAULT_LOCALE;

  let siteName: string | undefined;
  try {
    const siteId = await resolveSiteId();
    const siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
    siteName = siteInfo?.name?.trim() || getPlatformName(siteInfo, locale);
  } catch {
    // Metadata is best-effort; fall back to the generic platform name below.
  }

  const name = siteName || getPlatformName(null);
  return {
    title: {
      default: name,
      template: `%s | ${name}`,
    },
  };
}

export default async function PublicLayout({ children, params }: LocaleLayoutProps) {
  const { locale: paramsLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramsLocale) ? paramsLocale : DEFAULT_LOCALE;
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  const preferences = parseAcceptLanguage(acceptLanguage);
  const resolvedLocale = findBestMatchingTag(preferences, locale) ?? locale;
  let siteInfo = null;
  try {
    const siteId = await resolveSiteId();
    siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
    if (process.env.NODE_ENV !== 'production' && siteInfo) {
      // Validate that siteInfo is serializable (locales should be removed by repository)
      assertSerializableDev(siteInfo, 'siteInfo');
    }
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let children handle null siteInfo (e.g., UnderConstruction page)
  }

  return (
    <I18nProvider initialLocale={locale}>
      <I18nGate>
        <script dangerouslySetInnerHTML={{ __html: `if(!document.cookie.match(/(?:^|;)\\s*tz=/)){document.cookie='tz='+Intl.DateTimeFormat().resolvedOptions().timeZone+';path=/;max-age=31536000;SameSite=Lax'}` }} />
        <PublicLayoutShell siteInfo={siteInfo} locale={locale} resolvedLocale={resolvedLocale}>
          {children}
        </PublicLayoutShell>
        <Analytics />
      </I18nGate>
    </I18nProvider>
  );
}
