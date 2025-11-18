/**
 * Centralized URL generation utility
 *
 * Provides consistent URL generation across the application,
 * especially for emails and external links.
 */

import { AppRoute, ApiRoute, type UrlParams } from '@/entities/Routes';

// Re-export for convenience
export { AppRoute, ApiRoute, type UrlParams };

/**
 * Route definitions with their path templates
 */
export const routePaths: Record<AppRoute, string> = {
  // Public pages
  [AppRoute.HOME]: '/{locale}',
  [AppRoute.CONTACT]: '/{locale}/contact',
  [AppRoute.BLOG]: '/{locale}/blog',
  [AppRoute.BLOG_POST]: '/{locale}/blog/{id}',

  // Auth pages
  [AppRoute.AUTH_SIGNUP]: '/auth/signup',
  [AppRoute.AUTH_SIGNUP_VERIFY]: '/auth/signup/verify',
  [AppRoute.AUTH_INVITE]: '/auth/invite/{token}',
  [AppRoute.AUTH_INVITE_VERIFY]: '/auth/invite/{token}/verify',
  [AppRoute.AUTH_WELCOME_CREDENTIALS]: '/auth/welcome/credentials',
  [AppRoute.AUTH_PASSWORD_RESET]: '/auth/password/reset',

  // App pages (member area)
  [AppRoute.APP_DASHBOARD]: '/app',
  [AppRoute.APP_CALENDAR]: '/app/calendar',
  [AppRoute.APP_BLOG]: '/app/blog',
  [AppRoute.APP_SETTINGS]: '/app/settings',

  // Admin pages
  [AppRoute.ADMIN_DASHBOARD]: '/admin',
  [AppRoute.ADMIN_SITE_MEMBERS]: '/admin/site-members',
  [AppRoute.ADMIN_PENDING_MEMBERS]: '/admin/pending',
  [AppRoute.ADMIN_ANNIVERSARIES]: '/admin/anniversaries',
};


/**
 * Get a relative path (without base URL) for a route
 *
 * @example
 * getPath(AppRoute.ADMIN_SITE_MEMBERS)
 * // => "/admin/site-members"
 */
export function getPath(
  route: AppRoute,
  params?: UrlParams,
  queryParams?: Record<string, string | undefined>
): string {
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

  return path;
}

/**
 * API route path templates
 * Routes with {id}, {photoId}, {pageId}, {userId}, {memberId} etc. should be passed via pathParams
 */
const apiRoutePaths: Record<ApiRoute, string> = {
  // Auth routes (non-site-scoped)
  [ApiRoute.AUTH_ME]: '/api/auth/me',
  [ApiRoute.AUTH_LOGOUT]: '/api/auth/logout',
  [ApiRoute.AUTH_REFRESH]: '/api/auth/refresh',
  [ApiRoute.AUTH_LOGIN]: '/api/auth/login',
  [ApiRoute.AUTH_SIGNUP_REQUEST_VERIFICATION]: '/api/signup/request-verification',
  [ApiRoute.AUTH_SIGNUP_COMPLETE_VERIFICATION]: '/api/signup/complete-verification',

  // Site info
  [ApiRoute.SITE_INFO]: '/api/site/{siteId}',
  [ApiRoute.SITE_DESCRIPTION]: '/api/site/{siteId}/description',
  [ApiRoute.SITE_SETTINGS]: '/api/site/{siteId}/settings',

  // Pictures & Photos
  [ApiRoute.SITE_PICTURES]: '/api/site/{siteId}/pictures',
  [ApiRoute.SITE_PHOTOS]: '/api/site/{siteId}/photos',
  [ApiRoute.SITE_PHOTO_BY_ID]: '/api/site/{siteId}/photos/{photoId}',
  [ApiRoute.SITE_PHOTO_IMAGE_LIKES]: '/api/site/{siteId}/photos/{photoId}/image-likes',

  // Anniversaries & Calendar
  [ApiRoute.SITE_ANNIVERSARIES]: '/api/site/{siteId}/anniversaries',
  [ApiRoute.SITE_ANNIVERSARY_BY_ID]: '/api/site/{siteId}/anniversaries/{anniversaryId}',
  [ApiRoute.SITE_ANNIVERSARY_EVENT_IMAGE_LIKES]: '/api/site/{siteId}/anniversaries/{anniversaryId}/events/{eventId}/image-likes',
  [ApiRoute.SITE_ANNIVERSARY_EVENTS]: '/api/site/{siteId}/anniversaries/{anniversaryId}/events',
  [ApiRoute.SITE_ANNIVERSARY_BLESSING_PAGES]: '/api/site/{siteId}/anniversaries/{anniversaryId}/blessing-pages',
  [ApiRoute.SITE_CALENDAR_OCCURRENCES]: '/api/site/{siteId}/calendar/occurrences',

  // Members
  [ApiRoute.SITE_MEMBER_INFO]: '/api/site/{siteId}/member-info',
  [ApiRoute.SITE_MEMBERS]: '/api/site/{siteId}/members',
  [ApiRoute.SITE_MEMBERS_PUBLIC]: '/api/site/{siteId}/members/public',
  [ApiRoute.SITE_MEMBERS_COUNT]: '/api/site/{siteId}/members/count',
  [ApiRoute.SITE_MEMBER_BY_ID]: '/api/site/{siteId}/members/{memberId}',
  [ApiRoute.SITE_MEMBERS_APPROVE]: '/api/site/{siteId}/members/approve',
  [ApiRoute.SITE_MEMBERS_REJECT]: '/api/site/{siteId}/members/reject',
  [ApiRoute.SITE_PENDING_MEMBERS]: '/api/site/{siteId}/pending-members',
  [ApiRoute.SITE_PENDING_MEMBERS_APPROVE]: '/api/site/{siteId}/pending-members/approve',
  [ApiRoute.SITE_PENDING_MEMBERS_REJECT]: '/api/site/{siteId}/pending-members/reject',
  [ApiRoute.SITE_INVITES]: '/api/site/{siteId}/invites',

  // Profile
  [ApiRoute.SITE_PROFILE]: '/api/site/{siteId}/profile',
  [ApiRoute.SITE_PROFILE_AVATAR]: '/api/site/{siteId}/profile/avatar',

  // Blog
  [ApiRoute.SITE_BLOG]: '/api/site/{siteId}/blog',
  [ApiRoute.SITE_BLOG_COUNT]: '/api/site/{siteId}/blog/count',
  [ApiRoute.SITE_BLOG_ENABLE]: '/api/site/{siteId}/blog/enable',
  [ApiRoute.SITE_BLOG_SLUG_CHECK]: '/api/site/{siteId}/blog/check-handle',

  // Blessing Pages
  [ApiRoute.SITE_BLESSING_PAGES_BY_SLUG]: '/api/site/{siteId}/blessing-pages/by-slug/{slug}',
  [ApiRoute.SITE_BLESSING_PAGE_BLESSINGS]: '/api/site/{siteId}/blessing-pages/{pageId}/blessings',
  [ApiRoute.SITE_BLESSING_BY_ID]: '/api/site/{siteId}/blessing-pages/{pageId}/blessings/{blessingId}',

  // Admin
  [ApiRoute.SITE_ADMIN_CONTACT]: '/api/site/{siteId}/admin/contact',
  [ApiRoute.SITE_ADMIN_CACHE_REVALIDATE]: '/api/site/{siteId}/admin/cache/revalidate',
  [ApiRoute.SITE_ADMIN_USER_HARD_DELETE]: '/api/site/{siteId}/admin/users/{userId}/hard-delete',
  [ApiRoute.SITE_ADMIN_OWNER]: '/api/site/{siteId}/admin/owner',

  // Contact
  [ApiRoute.SITE_CONTACT]: '/api/site/{siteId}/contact',
};

/**
 * Get an API path with siteId and path params substituted
 *
 * @example
 * getApiPath(ApiRoute.SITE_PICTURES, 'abc123')
 * // => "/api/site/abc123/pictures"
 *
 * @example
 * getApiPath(ApiRoute.SITE_PHOTO_BY_ID, 'abc123', { photoId: 'photo_123' })
 * // => "/api/site/abc123/photos/photo_123"
 *
 * @example
 * getApiPath(ApiRoute.SITE_ANNIVERSARIES, 'abc123', {}, { month: '5', year: '2024' })
 * // => "/api/site/abc123/anniversaries?month=5&year=2024"
 */
export function getApiPath(
  route: ApiRoute,
  siteId: string,
  pathParams?: Record<string, string | undefined>,
  queryParams?: Record<string, string | undefined>
): string {
  let path = apiRoutePaths[route];

  // Substitute siteId
  path = path.replace('{siteId}', siteId);

  // Substitute path parameters (photoId, memberId, etc.)
  if (pathParams) {
    Object.entries(pathParams).forEach(([key, value]) => {
      if (value !== undefined) {
        path = path.replace(`{${key}}`, value);
      }
    });
  }

  // Check for unsubstituted parameters
  const unsubstituted = path.match(/\{([^}]+)\}/);
  if (unsubstituted) {
    throw new Error(
      `Missing required path parameter "${unsubstituted[1]}" for route ${route}. ` +
      `Path template: "${apiRoutePaths[route]}"`
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

  return path;
}
