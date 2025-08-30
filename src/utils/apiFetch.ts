import { landingPage } from "@/app/settings";

let refreshPromise: Promise<Response> | null = null;

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

export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<T> {
  const url = typeof input === 'string' ? input : (input as URL).toString();
  const req = () => fetch(input, { ...init, credentials: 'include' });

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
  return ct.includes('application/json')
    ? (res.json() as Promise<T>)
    : ((await res.text()) as unknown as T);
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
  return ct.includes('application/json')
    ? (res.json() as Promise<T>)
    : ((await res.text()) as unknown as T);
}
