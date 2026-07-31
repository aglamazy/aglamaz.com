import type { Metadata } from 'next';
import TermsEn from '@/components/legal/TermsContent.en';
import TermsHe from '@/components/legal/TermsContent.he';
import TermsTr from '@/components/legal/TermsContent.tr';
import TermsAr from '@/components/legal/TermsContent.ar';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { getServerT } from '@/utils/serverTranslations';
const SUPPORTED = SUPPORTED_LOCALES.length ? SUPPORTED_LOCALES : ['en', 'he'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const t = await getServerT(locale);

  return buildPageMetadata({
    locale,
    path: 'terms',
    title: t('termsAndConditions') as string,
    description: t('termsPageDescription') as string,
    type: 'website',
  });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  switch (locale) {
    case 'he':
      return <TermsHe />;
    case 'tr':
      return <TermsTr />;
    case 'ar':
      return <TermsAr />;
    case 'en':
    default:
      return <TermsEn />;
  }
}
