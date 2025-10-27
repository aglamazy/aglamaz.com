import type { Metadata } from 'next';
import LandingPage from '@/components/home/LandingPage';
import UnderConstruction from '@/components/UnderConstruction';
import { fetchSiteInfo, fetchPlatformDescription, fetchSiteDescription } from '@/firebase/admin';
import { resolveSiteId, resolveSiteIdWithOverride } from '@/utils/resolveSiteId';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

export const dynamic = 'force-dynamic';

function resolveBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  try {
    const headerStore = headers();
    const host = headerStore.get('host');
    if (!host) return null;
    const proto = headerStore.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

interface HomePageProps {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = SUPPORTED_LOCALES.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  const baseUrl = resolveBaseUrl();
  const canonical = baseUrl ? `${baseUrl}/${locale}` : undefined;

  return {
    alternates: baseUrl
      ? {
          canonical,
          languages: {
            en: `${baseUrl}/en`,
            he: `${baseUrl}/he`,
            'x-default': `${baseUrl}/en`,
          },
        }
      : undefined,
  } satisfies Metadata;
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const locale = SUPPORTED_LOCALES.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  // Resolve site ID based on hostname or query param (for local dev)
  const overrideSiteId = resolveSiteIdWithOverride(searchParams);
  const siteId = overrideSiteId || await resolveSiteId();

  // If no site ID is resolved, show "Under Construction" page
  if (!siteId) {
    const h = headers();
    const host = h.get('host') || 'unknown';
    return <UnderConstruction domain={host} />;
  }

  let siteInfo = null;
  let platformDescription = null;
  let siteDescription = null;

  try {
    // Fetch site info, site description, and platform description in parallel
    [siteInfo, siteDescription, platformDescription] = await Promise.all([
      fetchSiteInfo(siteId),
      fetchSiteDescription(siteId),
      fetchPlatformDescription(),
    ]);
  } catch (error) {
    console.error('Failed to fetch data for home page:', error);
    throw error;
  }

  const h = headers();
  const baseUrl = resolveBaseUrl();

  return (
    <LandingPage
      siteInfo={siteInfo}
      siteDescription={siteDescription}
      platformDescription={platformDescription}
      lang={locale}
      baseUrl={baseUrl}
    />
  );
}
