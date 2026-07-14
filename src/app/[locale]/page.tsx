import type { Metadata } from 'next';
import LandingPage from '@/components/home/LandingPage';
import UnderConstruction from '@/components/UnderConstruction';
import { fetchSiteInfo, fetchPlatformDescription, fetchSiteDescription } from '@/firebase/admin';
import { resolveSiteId, resolveSiteIdWithOverride } from '@/utils/resolveSiteId';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { getServerT } from '@/utils/serverTranslations';
import { stripScriptTags, cleanJsonLd } from '@/utils/jsonld';
import {
  createBreadcrumbSchema,
  createOrganizationSchema,
  createWebSiteSchema,
} from '@/utils/blogSchema';

export const dynamic = 'force-dynamic';

function resolveConfiguredBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

async function resolveRequestBaseUrl() {
  const configured = resolveConfiguredBaseUrl();
  if (configured) {
    return configured;
  }

  try {
    const headerStore = await headers();
    const host = headerStore.get('host');
    if (!host) return null;
    const proto = headerStore.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  let siteName: string | undefined;
  let aboutFamily: string | undefined;
  try {
    const siteId = await resolveSiteId();
    const siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
    siteName = siteInfo?.name?.trim() || undefined;
    aboutFamily = siteInfo?.aboutFamily?.trim() || undefined;
  } catch {
    // Metadata is best-effort; fall back to generic values below.
  }

  const title = siteName;
  const description =
    aboutFamily ||
    (siteName
      ? `${siteName} — a private family circle for shared stories, photos, blog posts and a family calendar.`
      : undefined);

  return buildPageMetadata({ locale, path: '', title, description, siteName, type: 'website' });
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  // Resolve site ID based on hostname or query param (for local dev)
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const overrideSiteId = resolveSiteIdWithOverride(resolvedSearchParams);
  const siteId = overrideSiteId || await resolveSiteId();

  // If no site ID is resolved, show "Under Construction" page
  if (!siteId) {
    const h = await headers();
    const host = h.get('host') || 'unknown';
    return <UnderConstruction domain={host} />;
  }

  let siteInfo = null;
  let platformDescription = null;
  let siteDescription = null;

  try {
    // Fetch site info, site description, and platform description in parallel
    [siteInfo, siteDescription, platformDescription] = await Promise.all([
      fetchSiteInfo(siteId, locale),
      fetchSiteDescription(siteId),
      fetchPlatformDescription(),
    ]);
  } catch (error) {
    console.error('Failed to fetch data for home page:', error);
    throw error;
  }

  const baseUrl = await resolveRequestBaseUrl();

  const baseLang = locale.split('-')[0]?.toLowerCase() || locale.toLowerCase();
  const t = await getServerT(baseLang);
  const siteName = siteInfo?.name?.trim() || 'FamCircle';
  const homeUrl = baseUrl ? `${baseUrl}/${locale}` : undefined;

  const jsonLd = stripScriptTags(
    JSON.stringify(
      [
        createOrganizationSchema({ baseUrl: baseUrl ?? undefined, siteName }),
        createWebSiteSchema({ baseUrl: baseUrl ?? undefined, siteName, lang: baseLang }),
        createBreadcrumbSchema([{ name: t('home') as string, url: homeUrl }]),
      ].map(cleanJsonLd)
    )
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <LandingPage
        siteInfo={siteInfo}
        siteDescription={siteDescription}
        platformDescription={platformDescription}
        lang={locale}
        baseUrl={baseUrl}
      />
    </>
  );
}
