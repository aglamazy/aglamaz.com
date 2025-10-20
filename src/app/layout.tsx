import './globals.css';
import I18nProvider from '../components/I18nProvider';
import I18nGate from '../components/I18nGate';
import { fetchSiteInfo } from '../firebase/admin';
import type { Metadata } from 'next';

const GOOGLE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || '';
export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteInfo = await fetchSiteInfo();
    const siteName = (siteInfo as any).name;
    return {
      title: {
        default: siteName,
        template: `%s | ${siteName}`,
      },
      icons: {
        icon: '/favicon.svg',
      },
      verification: {
        google: GOOGLE_VERIFICATION,
      },
    };
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    throw error;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  return (
    <html lang="en">
      <body>
        {/* Inject siteInfo for client-side access */}
        <script
          id="__SITE_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo || {})};`,
          }}
        />
        <I18nProvider>
          <I18nGate>{children}</I18nGate>
        </I18nProvider>
      </body>
    </html>
  );
}
