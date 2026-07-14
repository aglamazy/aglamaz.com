import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  return buildPageMetadata({
    locale,
    path: 'contact',
    title: 'Contact Us',
    description: 'Get in touch with the family — send us a message.',
    type: 'website',
  });
}

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
