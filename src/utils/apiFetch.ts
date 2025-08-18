export async function apiFetch<T = any>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    return fetch(input, { ...init, credentials: 'include' });
  };

  let res = await doFetch();

  if (res.status === 401) {
    // try refresh
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refresh.ok) {
      res = await doFetch();
    } else {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
  }

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json() as Promise<T>;
  }

  // fallback: return raw text
  return (await res.text()) as unknown as T;
}
