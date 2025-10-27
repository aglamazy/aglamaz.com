import type { Metadata } from 'next';
import TermsEn from '@/components/legal/TermsContent.en';
import TermsHe from '@/components/legal/TermsContent.he';
import TermsTr from '@/components/legal/TermsContent.tr';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { headers } from 'next/headers';

const SUPPORTED = SUPPORTED_LOCALES.length ? SUPPORTED_LOCALES : ['en', 'he'];

function resolveBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  try {
    const headerStore = headers();
    const host = headerStore.get('host');
    if (!host) return null;
    const proto = headerStore.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = SUPPORTED.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  const baseUrl = resolveBaseUrl();
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

export default function TermsPage({ params }: { params: { locale: string } }) {
  const locale = SUPPORTED.includes(params.locale) ? params.locale : DEFAULT_LOCALE;

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
