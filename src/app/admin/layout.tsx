import ClientLayoutShell from '@/components/ClientLayoutShell';
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

function extractQueryLocale(rawNextUrl: string | null): string | undefined {
  if (!rawNextUrl) return undefined;
  try {
    const url = rawNextUrl.startsWith('http')
      ? new URL(rawNextUrl)
      : new URL(rawNextUrl, 'http://localhost');
    return url.searchParams.get('locale') ?? undefined;
  } catch {
    return undefined;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  const preferences = parseAcceptLanguage(acceptLanguage);
  const fallbackBase = findBestSupportedLocale(preferences, SUPPORTED_LOCALES) ?? DEFAULT_LOCALE;

  const queryLocaleCandidate = extractQueryLocale(headerStore.get('next-url'));
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
    <ClientLayoutShell initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
      {children}
    </ClientLayoutShell>
  );
}
