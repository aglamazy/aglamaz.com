import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { headers } from 'next/headers';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getMemberFromToken } from '@/utils/serverAuth';
import I18nProvider from '@/components/I18nProvider';
import { resolveLocaleForPrivateRoutes } from '@/utils/resolveLocale';
import { fetchSiteInfo } from '@/firebase/admin';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: AppLayoutProps) {
  const headerStore = await headers();
  const isAuthGate = headerStore.get('x-auth-gate') === '1';

  // Get member preference for locale resolution
  const siteId = await resolveSiteId();
  const member = siteId ? await getMemberFromToken(siteId) : null;

  // Resolve locale with priority: query param > member preference > Accept-Language
  const { baseLocale, resolvedLocale } = await resolveLocaleForPrivateRoutes(
    member?.defaultLocale
  );

  // Fetch site info with resolved locale for client-side hydration
  let siteInfo = null;
  try {
    siteInfo = siteId
      ? await fetchSiteInfo(siteId, baseLocale)
      : await fetchSiteInfo(undefined, baseLocale);
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let the app render with null siteInfo
  }

  return (
    <ErrorBoundary>
      {isAuthGate ? (
        <>{children}</>
      ) : (
        <>
          {/* Inject siteInfo for client-side access */}
          <script
            id="__SITE_INFO__"
            dangerouslySetInnerHTML={{
              __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo ?? null)};`,
            }}
          />
          <I18nProvider initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
            <ClientLayoutShell>{children}</ClientLayoutShell>
          </I18nProvider>
        </>
      )}
    </ErrorBoundary>
  );
}
