import { headers } from 'next/headers';
import { fetchSiteIdByDomain } from '@/firebase/admin';

/**
 * Resolves the site ID based on the request hostname.
 *
 * Resolution priority:
 * 1. Domain mapping: Look up domain in Firebase domain_mappings collection
 * 2. NEXT_SITE_ID env variable: Temporary fallback (will be removed later)
 * 3. Return null: Show "Under Construction" page
 *
 * @returns The resolved site ID, or null if no configuration exists
 */
export async function resolveSiteId(): Promise<string | null> {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const hostname = host.split(':')[0]; // Remove port if present

  // 1. Try domain mapping lookup
  try {
    const mappedSiteId = await fetchSiteIdByDomain(hostname);
    if (mappedSiteId) {
      return mappedSiteId;
    }
  } catch (error) {
    console.error(`[resolveSiteId] failed to fetch domain mapping for ${hostname}`, error);
  }

  // 2. Fall back to NEXT_SITE_ID env variable (temporary - will remove later)
  const envSiteId = process.env.NEXT_SITE_ID;
  if (envSiteId) {
    return envSiteId;
  }

  // 3. No configuration found
  return null;
}

/**
 * Extracts site ID from hostname.
 *
 * Examples:
 * - aglamaz.com → uses env variable (returns null to trigger env check)
 * - levi.famcircle.org → "levi"
 * - cohen.famcircle.org → "cohen"
 * - levi.famcircle.local → "levi" (for local development)
 * - localhost:3000 → uses env variable (returns null)
 */
export function extractSiteIdFromHost(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  // Check if it's a famcircle.org subdomain (production)
  const famcircleMatch = hostname.match(/^([^.]+)\.famcircle\.org$/);
  if (famcircleMatch) {
    return famcircleMatch[1]; // Return subdomain as siteId
  }

  // Check if it's a famcircle.local subdomain (local development with /etc/hosts)
  const localMatch = hostname.match(/^([^.]+)\.famcircle\.local$/);
  if (localMatch) {
    return localMatch[1]; // Return subdomain as siteId
  }

  // For localhost, 127.0.0.1, aglamaz.com, or aglamaz.local, return null (will fall back to env variable)
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'aglamaz.com' ||
    hostname === 'aglamaz.local'
  ) {
    return null;
  }

  // Unknown domain
  return null;
}

/**
 * For local development: allows overriding site via query param
 * Usage: http://localhost:3000?site=levi
 */
export function resolveSiteIdWithOverride(searchParams?: Record<string, string | string[] | undefined>): string | null {
  const siteParam = Array.isArray(searchParams?.site)
    ? searchParams?.site[0]
    : searchParams?.site;

  return siteParam?.toString() || null;
}
