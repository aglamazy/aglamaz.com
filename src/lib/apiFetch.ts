let refreshPromise: Promise<Response> | null = null;

export async function apiFetch<T = any>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const doFetch = () => fetch(input, { ...init, credentials: 'include' });

  let res = await doFetch();
  if (res.status !== 401) return res.json() as Promise<T>;

  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .finally(() => { refreshPromise = null; });
  }
  const rr = await refreshPromise;
  if (!rr.ok) throw new Error('Unauthorized');

  res = await doFetch();
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}
