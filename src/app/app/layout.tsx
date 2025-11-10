import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import {
  findBestMatchingTag,
  findBestSupportedLocale,
  parseAcceptLanguage,
  sanitizeLocaleCandidate,
} from '@/utils/locale';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { fetchMemberPreferredLocale } from '@/utils/memberPreferredLocale';

interface AppLayoutProps {
  children: React.ReactNode;
  params?: any;
  searchParams?: Promise<{ locale?: string }>;
}

export default async function RootLayout({
  children,
  searchParams,
}: AppLayoutProps) {
  const headerStore = await headers();
  const isAuthGate = headerStore.get('x-auth-gate') === '1';
  const acceptLanguage = headerStore.get('accept-language');
  const preferences = parseAcceptLanguage(acceptLanguage);
  const fallbackBase = findBestSupportedLocale(preferences, SUPPORTED_LOCALES) ?? DEFAULT_LOCALE;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryLocaleCandidate = resolvedSearchParams?.locale;
  const queryLocale = sanitizeLocaleCandidate(queryLocaleCandidate, SUPPORTED_LOCALES);

  let baseLocale = queryLocale;
  if (!baseLocale) {
    const siteId = await resolveSiteId();
    const memberLocale = sanitizeLocaleCandidate(
      await fetchMemberPreferredLocale(siteId),
      SUPPORTED_LOCALES,
    );
    baseLocale = memberLocale ?? fallbackBase;
  }

  const resolvedLocale = findBestMatchingTag(preferences, baseLocale) ?? baseLocale;

  return (
    <ErrorBoundary>
      {isAuthGate ? (
        <>{children}</>
      ) : (
        <ClientLayoutShell initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
          {children}
        </ClientLayoutShell>
      )}
    </ErrorBoundary>
  );
}
