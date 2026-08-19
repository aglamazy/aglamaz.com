import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import TermsEn from '@/components/legal/TermsContent.en';
import TermsHe from '@/components/legal/TermsContent.he';
import TermsTr from '@/components/legal/TermsContent.tr';
import TermsAr from '@/components/legal/TermsContent.ar';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata, resolveMetadataBaseUrl } from '@/utils/seo';
import { getServerT } from '@/utils/serverTranslations';
import { stripScriptTags, cleanJsonLd } from '@/utils/jsonld';
import { createBreadcrumbSchema } from '@/utils/blogSchema';
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
  const t = await getServerT(locale);
  const baseUrl = await resolveMetadataBaseUrl();

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: t('home') as string, url: baseUrl ? `${baseUrl}/${locale}` : undefined },
    { name: t('termsAndConditions') as string, url: baseUrl ? `${baseUrl}/${locale}/terms` : undefined },
  ]);
  const structuredData = stripScriptTags(JSON.stringify(cleanJsonLd(breadcrumbSchema)));

  let content: ReactNode;
  switch (locale) {
    case 'he':
      content = <TermsHe />;
      break;
    case 'tr':
      content = <TermsTr />;
      break;
    case 'ar':
      content = <TermsAr />;
      break;
    case 'en':
    default:
      content = <TermsEn />;
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      {content}
    </>
  );
}
