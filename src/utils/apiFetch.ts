export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 401) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refresh.ok) {
      return fetch(input, { ...init, credentials: 'include' });
    } else {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  }
  return res;
}
