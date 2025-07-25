import './globals.css';
import ClientLayoutShell from '../components/ClientLayoutShell';
import { fetchSiteInfo } from '../firebase/admin';

export default async function RootLayout({ children }) {
  const siteInfo = await fetchSiteInfo();

  return (
    <html lang="en">
      <body>
        {/* Inject siteInfo as a global variable for client-side hydration */}
        <script
          id="__SITE_INFO__"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteInfo || {}) }}
        />
        <ClientLayoutShell>
          {children}
        </ClientLayoutShell>
      </body>
    </html>
  );
}
