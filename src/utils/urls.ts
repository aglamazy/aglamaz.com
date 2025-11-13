/**
 * Centralized URL generation utility
 *
 * Provides consistent URL generation across the application,
 * especially for emails and external links.
 */

export enum AppRoute {
  // Public pages
  HOME = 'HOME',
  CONTACT = 'CONTACT',
  BLOG = 'BLOG',
  BLOG_POST = 'BLOG_POST',

  // Auth pages
  AUTH_SIGNUP = 'AUTH_SIGNUP',
  AUTH_SIGNUP_VERIFY = 'AUTH_SIGNUP_VERIFY',
  AUTH_INVITE = 'AUTH_INVITE',
  AUTH_INVITE_VERIFY = 'AUTH_INVITE_VERIFY',
  AUTH_WELCOME_CREDENTIALS = 'AUTH_WELCOME_CREDENTIALS',
  AUTH_PASSWORD_RESET = 'AUTH_PASSWORD_RESET',

  // App pages (member area)
  APP_DASHBOARD = 'APP_DASHBOARD',
  APP_CALENDAR = 'APP_CALENDAR',
  APP_BLOG = 'APP_BLOG',
  APP_SETTINGS = 'APP_SETTINGS',

  // Admin pages
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_SITE_MEMBERS = 'ADMIN_SITE_MEMBERS',
  ADMIN_PENDING_MEMBERS = 'ADMIN_PENDING_MEMBERS',
  ADMIN_ANNIVERSARIES = 'ADMIN_ANNIVERSARIES',
}

interface UrlParams {
  locale?: string;
  token?: string;
  siteId?: string;
  id?: string;
  handle?: string;
  code?: string;
  [key: string]: string | undefined;
}

/**
 * Route definitions with their path templates
 */
const routePaths: Record<AppRoute, string> = {
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
 * Get the base URL for the application
 *
 * @throws Error if NEXT_PUBLIC_APP_URL is not set
 */
export function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;

  if (!url || !url.trim()) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL environment variable is required but not set. ' +
      'This must be configured in your .env file and deployment environment.'
    );
  }

  return url.replace(/\/$/, '');
}

/**
 * Generate a URL for a specific route
 *
 * Uses NEXT_PUBLIC_APP_URL environment variable as the base URL.
 *
 * @param route - The route enum value
 * @param params - Parameters to substitute in the path template
 * @param queryParams - Optional query parameters to append
 *
 * @example
 * // Simple route
 * getUrl(AppRoute.ADMIN_SITE_MEMBERS)
 * // => "https://app.example.com/admin/site-members"
 *
 * @example
 * // Route with parameters
 * getUrl(AppRoute.AUTH_INVITE, { token: 'abc123' })
 * // => "https://app.example.com/auth/invite/abc123"
 *
 * @example
 * // Route with locale
 * getUrl(AppRoute.CONTACT, { locale: 'he' })
 * // => "https://app.example.com/he/contact"
 *
 * @example
 * // Route with query parameters
 * getUrl(AppRoute.AUTH_INVITE_VERIFY,
 *   { token: 'abc123' },
 *   { code: 'xyz789', locale: 'he' }
 * )
 * // => "https://app.example.com/auth/invite/abc123/verify?code=xyz789&locale=he"
 */
export function getUrl(
  route: AppRoute,
  params?: UrlParams,
  queryParams?: Record<string, string | undefined>
): string {
  const base = getBaseUrl();
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
