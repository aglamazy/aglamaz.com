import type { ReactNode } from 'react';
import PublicLayoutShell from '@/components/PublicLayoutShell';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export default async function PublicLayout({ children, params }: LocaleLayoutProps) {
  const locale = SUPPORTED_LOCALES.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  let siteInfo = null;
  try {
    const siteId = await resolveSiteId();
    siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let children handle null siteInfo (e.g., UnderConstruction page)
  }

  return <PublicLayoutShell siteInfo={siteInfo} locale={locale}>{children}</PublicLayoutShell>;
}
