import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

export default async function RootLayout({
  children,
  params,
  searchParams
}: {
  children: React.ReactNode;
  params?: any;
  searchParams?: { locale?: string };
}) {
  const h = await headers();
  const isAuthGate = h.get('x-auth-gate') === '1';

  // Priority: query param > header > default
  const queryLocale = searchParams?.locale;
  const headerLocale = h.get('x-locale');
  const resolvedLocale =
    (queryLocale && SUPPORTED_LOCALES.includes(queryLocale)) ? queryLocale :
    (headerLocale && SUPPORTED_LOCALES.includes(headerLocale)) ? headerLocale :
    DEFAULT_LOCALE;

  return (
    <ErrorBoundary>
      {isAuthGate ? <>{children}</> : <ClientLayoutShell initialLocale={resolvedLocale}>{children}</ClientLayoutShell>}
    </ErrorBoundary>
  );
}
