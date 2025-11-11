import ClientLayoutShell from '@/components/ClientLayoutShell';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getMemberFromToken } from '@/utils/serverAuth';
import I18nProvider from '@/components/I18nProvider';
import { resolveLocaleForPrivateRoutes } from '@/utils/resolveLocale';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Get member preference for locale resolution
  const siteId = await resolveSiteId();
  const member = siteId ? await getMemberFromToken(siteId) : null;

  // Resolve locale with priority: query param > member preference > Accept-Language
  const { baseLocale, resolvedLocale } = await resolveLocaleForPrivateRoutes(
    member?.defaultLocale
  );

  return (
    <I18nProvider initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
      <ClientLayoutShell>
        {children}
      </ClientLayoutShell>
    </I18nProvider>
  );
}
