import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { headers } from 'next/headers';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getMemberFromToken } from '@/utils/serverAuth';
import I18nProvider from '@/components/I18nProvider';
import { resolveLocaleForPrivateRoutes } from '@/utils/resolveLocale';

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

  return (
    <ErrorBoundary>
      {isAuthGate ? (
        <>{children}</>
      ) : (
        <I18nProvider initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
          <ClientLayoutShell>{children}</ClientLayoutShell>
        </I18nProvider>
      )}
    </ErrorBoundary>
  );
}
