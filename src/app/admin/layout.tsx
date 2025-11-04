import ClientLayoutShell from '@/components/ClientLayoutShell';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();

  // Get locale from header (set by middleware based on cookie or user preference)
  const headerLocale = h.get('x-locale');
  const resolvedLocale =
    (headerLocale && SUPPORTED_LOCALES.includes(headerLocale)) ? headerLocale : DEFAULT_LOCALE;

  // Reuse the authenticated site template (header, footer, modals)
  return <ClientLayoutShell initialLocale={resolvedLocale}>{children}</ClientLayoutShell>;
}

