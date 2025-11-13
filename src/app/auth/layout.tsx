import { ErrorBoundary } from '@/components/ErrorBoundary';
import I18nProvider from '@/components/I18nProvider';
import { resolveLocaleForPrivateRoutes } from '@/utils/resolveLocale';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  // Resolve locale for auth pages (no member preference, uses Accept-Language + query param)
  const { baseLocale, resolvedLocale } = await resolveLocaleForPrivateRoutes();

  // Fetch site info with resolved locale
  const siteId = await resolveSiteId();
  let siteInfo = null;
  try {
    siteInfo = siteId
      ? await fetchSiteInfo(siteId, baseLocale)
      : await fetchSiteInfo(undefined, baseLocale);
  } catch (error) {
    console.error('Failed to fetch site info:', error);
  }

  return (
    <ErrorBoundary>
      {/* Inject siteInfo for client-side access */}
      <script
        id="__SITE_INFO__"
        dangerouslySetInnerHTML={{
          __html: `window.__SITE_INFO__=${JSON.stringify(siteInfo ?? null)};`,
        }}
      />
      <I18nProvider initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
        {children}
      </I18nProvider>
    </ErrorBoundary>
  );
}
