import '../globals.css';
import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { fetchSiteInfo } from '../../firebase/admin';
import { headers } from 'next/headers';

export default async function RootLayout({ children }) {
  let siteInfo = null;
  const h = headers();
  const isAuthGate = h.get('x-auth-gate') === '1';

  try {
    if (!isAuthGate) siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  return (
    <html lang="en">
      <body>
        {/* Inject siteInfo as a global variable for client-side hydration */}
        <script
          id="__SITE_INFO__"
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo || {})};`,
          }}
        />
        <ErrorBoundary>{
          isAuthGate ? <>{children}</> :
          <ClientLayoutShell>
            {children}
          </ClientLayoutShell>
        }
        </ErrorBoundary>
      </body>
    </html>
  );
}
