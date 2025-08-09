import './globals.css';
import ClientLayoutShell from '../components/ClientLayoutShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fetchSiteInfo } from '../firebase/admin';

export default async function RootLayout({ children }) {
  let siteInfo: any = await fetchSiteInfo();
  if (!siteInfo) {
    siteInfo = { name: 'Family' };
  }

  return (
    <html lang="en">
      <body>
        {/* Inject siteInfo as a global variable for client-side hydration */}
        <script
          id="__SITE_INFO__"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteInfo || {}) }}
        />
        <ErrorBoundary>
          <ClientLayoutShell>
            {children}
          </ClientLayoutShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
