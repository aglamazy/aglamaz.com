import PublicLayoutShell from '@/components/PublicLayoutShell';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { DEFAULT_LOCALE } from '@/i18n';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  const locale = DEFAULT_LOCALE;
  try {
    const siteId = await resolveSiteId();
    siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let children handle null siteInfo
  }

  return <PublicLayoutShell siteInfo={siteInfo} locale={locale}>{children}</PublicLayoutShell>;
}
