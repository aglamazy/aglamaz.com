import PublicLayoutShell from '@/components/PublicLayoutShell';
import { fetchSiteInfo } from '@/firebase/admin';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  return <PublicLayoutShell siteInfo={siteInfo}>{children}</PublicLayoutShell>;
}
