import ClientLayoutShell from '@/components/ClientLayoutShell';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getMemberFromToken } from '@/utils/serverAuth';
import I18nProvider from '@/components/I18nProvider';
import { resolveLocaleForPrivateRoutes } from '@/utils/resolveLocale';
import { fetchSiteInfo } from '@/firebase/admin';
import { stripScriptTags } from '@/utils/jsonld';

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

  // Fetch site info with resolved locale for client-side hydration
  let siteInfo = null;
  try {
    siteInfo = siteId ? await fetchSiteInfo(siteId, baseLocale) : null;
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    // Don't throw - let the app render with null siteInfo
  }

  return (
    <>
      {/* Inject siteInfo for client-side access. Plain JSON, not an assignment statement:
          this data is read via textContent + JSON.parse (see SiteStore.ts), not by relying
          on the <script> executing - it never does on a client-side (soft) navigation. */}
      <script
        id="__SITE_INFO__"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: stripScriptTags(JSON.stringify(siteInfo ?? null)),
        }}
      />
      <I18nProvider initialLocale={baseLocale} resolvedLocale={resolvedLocale}>
        <ClientLayoutShell>
          {children}
        </ClientLayoutShell>
      </I18nProvider>
    </>
  );
}
