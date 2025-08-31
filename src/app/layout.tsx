import './globals.css';
import I18nProvider from '../components/I18nProvider';
import I18nGate from '../components/I18nGate';
import { fetchSiteInfo } from '../firebase/admin';

const GOOGLE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || '';
export const metadata = {
  verification: {
    google: GOOGLE_VERIFICATION,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  const googleVerify = process.env.GOOGLE_SITE_VERIFICATION || '';

  return (
    <html lang="en">
      <head>
        {googleVerify ? (
          <meta name="google-site-verification" content={googleVerify} />
        ) : null}
      </head>
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
