import { landingPage } from "@/app/settings";
import { shouldRefreshToken } from "@/auth/clientAuth";
import { ApiRoute, getApiPath } from './urls';
import { useSiteStore } from '@/store/SiteStore';

let refreshPromise: Promise<Response> | null = null;

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  pathParams?: Record<string, string | undefined>;
  queryParams?: Record<string, string | undefined>;
}

function refreshOnce() {
  return (refreshPromise ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  }).finally(() => {
    refreshPromise = null;
  }));
}

// Endpoints that should bypass refresh logic
const AUTH_RE = /^\/api\/auth\/(refresh|login|logout)(?:$|\?)/;

/**
 * Type-safe API fetch function that only accepts ApiRoute enums
 *
 * Automatically handles:
 * - siteId injection from store (for non-AUTH routes)
 * - Path parameter substitution (photoId, memberId, etc.)
 * - Query parameter appending
 * - Token refresh on 401
 * - JSON serialization
 *
 * @example
 * // Simple site-scoped request
 * await apiFetch(ApiRoute.SITE_PICTURES)
 *
 * @example
 * // With query params
 * await apiFetch(ApiRoute.SITE_PICTURES, {
 *   queryParams: { limit: '10', offset: '0' }
 * })
 *
 * @example
 * // With path params
 * await apiFetch(ApiRoute.SITE_PHOTO_BY_ID, {
 *   pathParams: { photoId: 'abc123' }
 * })
 *
 * @example
 * // POST with body
 * await apiFetch(ApiRoute.SITE_PHOTOS, {
 *   method: 'POST',
 *   body: { date: '2024-01-01', images: [...] }
 * })
 */
export async function apiFetch<T = unknown>(
  route: ApiRoute,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { pathParams, queryParams, body, ...fetchOptions } = options;

  // Build URL based on route type
  let url: string;
  if (route.startsWith('AUTH_')) {
    // Auth routes don't need siteId
    const authPaths: Record<string, string> = {
      AUTH_ME: '/api/auth/me',
      AUTH_INVITE_ME: '/api/auth/me',
      AUTH_LOGOUT: '/api/auth/logout',
      AUTH_REFRESH: '/api/auth/refresh',
      AUTH_LOGIN: '/api/auth/login',
      AUTH_SIGNUP_REQUEST_VERIFICATION: '/api/signup/request-verification',
      AUTH_SIGNUP_COMPLETE_VERIFICATION: '/api/signup/complete-verification',
      AUTH_SIGNUP_VERIFY: '/api/signup/verify',
      AUTH_ME_FIREBASE_TOKEN: '/api/auth/me/firebase-token',
    };
    url = authPaths[route];
    // Replace any path params in auth routes (e.g., token)
    if (pathParams) {
      Object.entries(pathParams).forEach(([key, value]) => {
        if (value !== undefined) {
          url = url.replace(`{${key}}`, value);
        }
      });
    }
    if (!url) {
      throw new Error(`[apiFetch] Unknown auth route: ${route}`);
    }
  } else {
    // Site-scoped routes need siteId
    const siteId = useSiteStore.getState().siteInfo?.id;
    if (!siteId) {
      throw new Error(`[apiFetch] Cannot call ${route}: siteId not available in store`);
    }
    url = getApiPath(route, siteId, pathParams, queryParams);
  }

  // Prepare fetch options
  const init: RequestInit = {
    ...fetchOptions,
    credentials: 'include',
  };

  // Handle body serialization
  if (body !== undefined) {
    if (typeof body === 'string') {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      init.headers = {
        'Content-Type': 'application/json',
        ...init.headers,
      };
    }
  }

  const req = () => fetch(url, init);

  // 1) Never run refresh logic on login/logout/refresh endpoints themselves
  if (AUTH_RE.test(url)) {
    const r = await req();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json')
      ? (r.json() as Promise<T>)
      : ((await r.text()) as unknown as T);
  }

  // 2) Normal requests
  let res = await req();

  if (res.status === 401) {
    const rr = await refreshOnce();
    if (rr.ok) res = await req();
  }

  // 3) Still unauthorized -> stop (no loops)
  if (res.status === 401) {
    if (typeof window !== 'undefined' && location.pathname !== landingPage) {
      location.assign(landingPage);
    }
    throw new Error('Unauthorized (apiFetch)');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json')
    ? (res.json() as Promise<T>)
    : ((await res.text()) as unknown as T);

  // 4) After response is ready, check if token needs refresh in next event loop (fire and forget)
  setTimeout(() => {
    if (shouldRefreshToken()) {
      console.log('[apiFetch] 🔄 Triggering proactive token refresh (>80% TTL)');
      void refreshOnce(); // Background refresh for next request
    }
  }, 0);

  return result;
}

// Same as apiFetch, but never redirects on 401. Useful for probes like /api/auth/me
export async function apiFetchSilent<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<T> {
  const url = typeof input === 'string' ? input : (input as URL).toString();
  const req = () => fetch(input, { ...init, credentials: 'include' });

  if (AUTH_RE.test(url)) {
    const r = await req();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json')
      ? (r.json() as Promise<T>)
      : ((await r.text()) as unknown as T);
  }

  let res = await req();
  if (res.status === 401) {
    const rr = await refreshOnce();
    if (rr.ok) res = await req();
  }

  if (res.status === 401) {
    // Do not redirect — let caller decide
    throw new Error('Unauthorized (apiFetchSilent)');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json')
    ? (res.json() as Promise<T>)
    : ((await res.text()) as unknown as T);

  // After response is ready, check if token needs refresh in next event loop (fire and forget)
  setTimeout(() => {
    if (shouldRefreshToken()) {
      console.log('[apiFetchSilent] 🔄 Triggering proactive token refresh (>80% TTL)');
      void refreshOnce(); // Background refresh for next request
    }
  }, 0);

  return result;
}
