import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { unstable_cache } from 'next/cache';
import { SiteRepository } from '@/repositories/SiteRepository';
import { PlatformRepository } from '@/repositories/PlatformRepository';

export function initAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
      }),
    });
  }
}

export const adminAuth = () => getAuth();

/**
 * Fetches site information from Firebase with caching.
 * Cache is per-site and survives cold starts on Vercel.
 *
 * @param siteId - Optional site ID. If not provided, falls back to NEXT_SITE_ID env variable.
 *                 For multi-tenant deployments, this should be passed from resolveSiteId().
 * @returns Site info object or null if no valid site ID is provided
 */
export async function fetchSiteInfo(siteId?: string | null) {
  // Resolve siteId: use parameter if provided, otherwise fall back to env variable
  const resolvedSiteId = siteId || process.env.NEXT_SITE_ID;

  if (!resolvedSiteId) {
    console.warn('[fetchSiteInfo] No site ID provided and NEXT_SITE_ID not set');
    return null;
  }

  const repo = new SiteRepository();
  return repo.get(resolvedSiteId, undefined, { cached: true });
}

/**
 * Fetches the site ID for a given domain from the domain_mappings collection.
 * This provides secure mapping from public domains to private site document IDs.
 * Cache survives cold starts and works across Vercel instances.
 *
 * @param domain - The domain to look up (e.g., "aglamaz.com", "levi.famcircle.org")
 * @returns The site ID string, or null if no mapping exists
 */
export async function fetchSiteIdByDomain(domain: string): Promise<string | null> {
  const repo = new SiteRepository();
  try {
    return await repo.getIdByDomain(domain, { cached: true });
  } catch (error) {
    console.error(`[domain-mapping] failed to fetch siteId for domain ${domain}`, error);
    return null;
  }
}

/**
 * Fetches platform description from Firebase with caching.
 * This content is centralized and editable only by the platform owner.
 * Cache survives cold starts and works across Vercel instances.
 */
const platformRepository = new PlatformRepository();
export const fetchPlatformDescription = unstable_cache(
  async () => platformRepository.getDescription(),
  ['platform-description'],
  {
    revalidate: 3600, // Revalidate every hour
    tags: ['platform-description'],
  }
);

/**
 * Fetches site description for a specific site from Firebase with caching.
 * This content is editable by the site admin.
 * Cache survives cold starts and works across Vercel instances.
 *
 * @param siteId - The site ID to fetch description for
 * @returns Site description object with title, content, and translations
 */
export async function fetchSiteDescription(siteId: string | null) {
  if (!siteId) {
    return {
      content: '',
      title: '',
      translations: {} as Record<string, { title: string; content: string }>,
    };
  }

  const repo = new SiteRepository();
  try {
    return await repo.getDescription(siteId, { cached: true });
  } catch (error) {
    console.error(`[site] failed to fetch site description for ${siteId}`, error);
    return {
      content: '',
      title: '',
      translations: {} as Record<string, { title: string; content: string }>,
    };
  }
}
