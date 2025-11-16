import { ACCESS_TOKEN } from './cookies';

/**
 * Get the access token from cookies (client-side only)
 */
export function getAccessTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const accessTokenCookie = cookies.find(c => c.trim().startsWith(`${ACCESS_TOKEN}=`));

  if (!accessTokenCookie) return null;

  const token = accessTokenCookie.split('=')[1];
  return token || null;
}

/**
 * Parse JWT token and return payload
 */
export function parseJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );

    return payload;
  } catch (err) {
    console.debug('[parseJWT] Failed to parse token:', err);
    return null;
  }
}

/**
 * Get token expiry info
 * @returns { exp, iat, ttl, elapsed, percentUsed } or null if token invalid
 */
export function getTokenExpiryInfo(): {
  exp: number;
  iat: number;
  ttl: number;
  elapsed: number;
  percentUsed: number;
} | null {
  const token = getAccessTokenFromCookie();
  if (!token) return null;

  const payload = parseJWT(token);
  if (!payload?.exp || !payload?.iat) return null;

  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const exp = payload.exp; // Expiry timestamp in seconds
  const iat = payload.iat; // Issued at timestamp in seconds
  const ttl = exp - iat; // Total lifetime
  const elapsed = now - iat; // Time since issued
  const percentUsed = elapsed / ttl;

  return {
    exp,
    iat,
    ttl,
    elapsed,
    percentUsed,
  };
}

/**
 * Check if token should be refreshed (>80% of TTL used)
 */
export function shouldRefreshToken(): boolean {
  const info = getTokenExpiryInfo();
  if (!info) return false;

  const now = Math.floor(Date.now() / 1000);

  // Refresh if we've used 80% or more of the token lifetime AND token not expired
  return info.percentUsed >= 0.8 && now < info.exp;
}
