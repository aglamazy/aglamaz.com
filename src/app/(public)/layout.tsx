import '../globals.css';
import I18nProvider from '../../components/I18nProvider';
import I18nGate from '../../components/I18nGate';
import PublicLayoutShell from '../../components/PublicLayoutShell';
import { fetchSiteInfo } from '../../firebase/admin';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  return (
    <I18nProvider>
      <I18nGate>
        {/* Inject siteInfo for client-side access */}
        <script
          id="__SITE_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo || {})};`,
          }}
        />
        <PublicLayoutShell siteInfo={siteInfo}>{children}</PublicLayoutShell>
      </I18nGate>
    </I18nProvider>
  );
}
