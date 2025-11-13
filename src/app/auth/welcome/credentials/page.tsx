import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import CredentialSetupClient from './CredentialSetupClient';
import { DEFAULT_LOCALE } from '@/i18n';

export default async function CredentialSetupPage() {
  const siteId = await resolveSiteId();
  let siteInfo = null;

  try {
    siteInfo = siteId ? await fetchSiteInfo(siteId, DEFAULT_LOCALE) : null;
  } catch (error) {
    console.error('[credentials-page] failed to load site info', error);
    // Don't throw - continue with null
  }

  if (!siteInfo) {
    throw new Error('Site information is unavailable');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream-50 to-sage-50">
      <Header siteInfo={siteInfo as any} />
      <main className="flex-1">
        <CredentialSetupClient />
      </main>
      <Footer siteInfo={siteInfo as any} />
    </div>
  );
}
