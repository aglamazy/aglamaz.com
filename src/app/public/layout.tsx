import PublicLayoutShell from '@/components/PublicLayoutShell';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { DEFAULT_LOCALE } from '@/i18n';
import { headers } from 'next/headers';
import { findBestMatchingTag, parseAcceptLanguage } from '@/utils/locale';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  const locale = DEFAULT_LOCALE;
  const headerStore = await headers();
  const preferences = parseAcceptLanguage(headerStore.get('accept-language'));
  const resolvedLocale = findBestMatchingTag(preferences, locale) ?? locale;
  try {
    const siteId = await resolveSiteId();
    siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let children handle null siteInfo
  }

  return (
    <PublicLayoutShell siteInfo={siteInfo} locale={locale} resolvedLocale={resolvedLocale}>
      {children}
    </PublicLayoutShell>
  );
}
