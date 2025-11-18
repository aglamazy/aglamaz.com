/**
 * Server-only URL utilities
 *
 * These functions use server-only APIs (like SiteRepository with revalidateTag)
 * and should only be imported in Server Components or API routes.
 */

import { AppRoute, type UrlParams } from '@/entities/Routes';
import { routePaths } from './urls';

// Re-export for convenience
export { AppRoute };

/**
 * Get the base URL for a specific site by looking up its domain mapping
 *
 * @param siteId - The site ID to get the domain for
 * @returns Base URL with protocol (e.g., "https://aglamaz.com")
 * @throws Error if domain mapping not found for siteId
 */
export async function getBaseUrlForSite(siteId: string): Promise<string> {
  const { SiteRepository } = await import('@/repositories/SiteRepository');
  const repo = new SiteRepository();

  const domain = await repo.getDomainBySiteId(siteId, { cached: true });

  if (!domain || !domain.trim()) {
    throw new Error(
      `No domain mapping found for siteId: ${siteId}. ` +
      'Please create a domainMappings document in Firebase.'
    );
  }

  // Use https for production domains, http for localhost
  const protocol = domain.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${domain}`;
}

/**
 * Generate a URL for a specific route for a given site
 *
 * Looks up the site's domain from domain_mappings collection and builds the full URL.
 *
 * @param route - The route enum value
 * @param siteId - The site ID to generate URL for
 * @param params - Parameters to substitute in the path template
 * @param queryParams - Optional query parameters to append
 *
 * @example
 * // Simple route
 * await getUrl(AppRoute.ADMIN_SITE_MEMBERS, 'XFptrxZIKXV6P2TjtGCL')
 * // => "https://aglamaz.com/admin/site-members"
 *
 * @example
 * // Route with parameters
 * await getUrl(AppRoute.AUTH_INVITE, 'XFptrxZIKXV6P2TjtGCL', { token: 'abc123' })
 * // => "https://aglamaz.com/auth/invite/abc123"
 *
 * @example
 * // Route with query parameters
 * await getUrl(AppRoute.AUTH_INVITE_VERIFY,
 *   'XFptrxZIKXV6P2TjtGCL',
 *   { token: 'abc123' },
 *   { code: 'xyz789', locale: 'he' }
 * )
 * // => "https://aglamaz.com/auth/invite/abc123/verify?code=xyz789&locale=he"
 */
export async function getUrl(
  route: AppRoute,
  siteId: string,
  params?: UrlParams,
  queryParams?: Record<string, string | undefined>
): Promise<string> {
  const base = await getBaseUrlForSite(siteId);
  let path = routePaths[route];

  // Substitute path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        path = path.replace(`{${key}}`, value);
      }
    });
  }

  // Check for unsubstituted parameters
  const unsubstituted = path.match(/\{([^}]+)\}/);
  if (unsubstituted) {
    throw new Error(
      `Missing required parameter "${unsubstituted[1]}" for route ${route}. ` +
      `Path template: "${routePaths[route]}"`
    );
  }

  // Add query parameters
  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      path += `?${queryString}`;
    }
  }

  return `${base}${path}`;
}
