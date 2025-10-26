import PublicLayoutShell from '@/components/PublicLayoutShell';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    const siteId = await resolveSiteId();
    siteInfo = siteId ? await fetchSiteInfo(siteId) : null;
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let children handle null siteInfo
  }

  return <PublicLayoutShell siteInfo={siteInfo}>{children}</PublicLayoutShell>;
}
