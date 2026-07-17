import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { getServerT } from '@/utils/serverTranslations';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const t = await getServerT(locale);

  return buildPageMetadata({
    locale,
    path: 'contact',
    title: t('contactUs') as string,
    description: t('contactPageDescription') as string,
    type: 'website',
  });
}

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
