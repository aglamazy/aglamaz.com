import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { cookies, headers } from 'next/headers';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getMemberFromReadToken, getMemberFromToken, getUserFromToken } from '@/utils/serverAuth';
import { RT_SESSION } from '@/auth/cookies';
import I18nProvider from '@/components/I18nProvider';
import { resolveLocaleForPrivateRoutes } from '@/utils/resolveLocale';
import { fetchSiteInfo } from '@/firebase/admin';
import { stripScriptTags } from '@/utils/jsonld';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: AppLayoutProps) {
  const headerStore = await headers();
  const isAuthGate = headerStore.get('x-auth-gate') === '1';

  // Get user from token for SSR
  const userToken = await getUserFromToken();
  const userData = userToken ? {
    user_id: userToken.sub!,
    email: userToken.email!,
    email_verified: userToken.email_verified!,
    name: userToken.name!,
    picture: userToken.picture!,
    needsCredentialSetup: userToken.needsCredentialSetup!,
  } : null;

  // Get member and site info for SSR
  const siteId = await resolveSiteId();
  const sessionMember = siteId ? await getMemberFromToken(siteId) : null;

  // No Firebase session at all - fall back to a read-only member context resolved from the
  // RT_SESSION cookie (set by src/proxy.ts after verifying a `?rt=` read-token). This is the
  // page-level counterpart to withReadableGuard's API-route pattern - same resulting member
  // shape, just flagged read-only below so the client (famcircle#126) knows not to treat it
  // as a full session.
  let isReadOnly = false;
  let member = sessionMember;
  if (!userData && !sessionMember && siteId) {
    const cookieStore = await cookies();
    const rtSessionValue = cookieStore.get(RT_SESSION)?.value ?? null;
    const readOnlyMember = await getMemberFromReadToken(siteId, rtSessionValue);
    if (readOnlyMember) {
      member = readOnlyMember;
      isReadOnly = true;
    }
  }

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
    <ErrorBoundary>
      {isAuthGate ? (
        <>{children}</>
      ) : (
        <>
          {/* Inject server-side data for client-side hydration. Plain JSON, not an assignment
              statement: this data is read via textContent + JSON.parse (see the store
              hydrateFromWindow()s), not by relying on the <script> executing - it never does
              on a client-side (soft) navigation. */}
          <script
            id="__SITE_INFO__"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: stripScriptTags(JSON.stringify(siteInfo ?? null)),
            }}
          />
          <script
            id="__USER__"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: stripScriptTags(JSON.stringify(userData ?? null)),
            }}
          />
          <script
            id="__MEMBER__"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: stripScriptTags(JSON.stringify(member ?? null)),
            }}
          />
          <script
            id="__READONLY__"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: stripScriptTags(JSON.stringify(isReadOnly)),
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
