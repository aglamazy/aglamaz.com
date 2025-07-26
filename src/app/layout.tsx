import './globals.css';
import ClientLayoutShell from '../components/ClientLayoutShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fetchSiteInfo } from '../firebase/admin';

export default async function RootLayout({ children }) {
  let siteInfo = null;
  
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    siteInfo = { name: 'Family' }; // fallback
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
