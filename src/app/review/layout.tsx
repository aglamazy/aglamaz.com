import type { ReactNode } from 'react';
import I18nProvider from '@/components/I18nProvider';
import I18nGate from '@/components/I18nGate';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE } from '@/i18n';
import { findBestMatchingTag, parseAcceptLanguage } from '@/utils/locale';

// Token-gated review page: no site chrome (header/footer/login), no member session
// required. Locale is inferred from Accept-Language since there's no [locale] segment.
export const dynamic = 'force-dynamic';

export default async function ReviewLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const preferences = parseAcceptLanguage(headerStore.get('accept-language'));
  const resolvedLocale = findBestMatchingTag(preferences, DEFAULT_LOCALE) ?? DEFAULT_LOCALE;

  return (
    <I18nProvider initialLocale={DEFAULT_LOCALE} resolvedLocale={resolvedLocale}>
      <I18nGate>{children}</I18nGate>
    </I18nProvider>
  );
}
