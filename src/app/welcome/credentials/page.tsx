import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchSiteInfo } from '@/firebase/admin';
import CredentialSetupClient from './CredentialSetupClient';

export default async function CredentialSetupPage() {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('[credentials-page] failed to load site info', error);
    throw error;
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
