import type { Metadata } from 'next';
import TermsEn from '@/components/legal/TermsContent.en';
import TermsHe from '@/components/legal/TermsContent.he';
import TermsTr from '@/components/legal/TermsContent.tr';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
const SUPPORTED = SUPPORTED_LOCALES.length ? SUPPORTED_LOCALES : ['en', 'he'];

function resolveConfiguredBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const baseUrl = resolveConfiguredBaseUrl();
  const canonical = baseUrl ? `${baseUrl}/${locale}/terms` : undefined;

  return {
    title: 'Terms and Conditions',
    alternates: baseUrl
      ? {
          canonical,
          languages: {
            en: `${baseUrl}/en/terms`,
            he: `${baseUrl}/he/terms`,
            'x-default': `${baseUrl}/en/terms`,
          },
        }
      : undefined,
  } satisfies Metadata;
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  switch (locale) {
    case 'he':
      return <TermsHe />;
    case 'tr':
      return <TermsTr />;
    case 'en':
    default:
      return <TermsEn />;
  }
}
