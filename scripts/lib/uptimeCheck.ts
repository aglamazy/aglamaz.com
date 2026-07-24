/**
 * Core uptime-check logic, factored out of scripts/uptime-check.ts so tests
 * can exercise it against a local HTTP server without spawning the CLI.
 */

export interface UptimeCheckResult {
  url: string;
  reachable: boolean;
  statusCode?: number;
  healthy: boolean;
  body?: unknown;
  error?: string;
}

/**
 * Hit `${baseUrl}/api/health` and decide whether the deployment is up.
 * "Up" means: the HTTP request completed, returned a healthCheck JSON body,
 * and `overall.healthy` is true (matches src/app/api/health/route.ts's shape).
 * Any network failure, timeout, non-JSON body, or `overall.healthy !== true`
 * counts as down — this function never throws, callers just check the result.
 */
export async function checkHealth(baseUrl: string, timeoutMs = 10_000): Promise<UptimeCheckResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const statusCode = res.status;

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { url, reachable: true, statusCode, healthy: false, error: 'response body was not valid JSON' };
    }

    const overall = (body as { overall?: { healthy?: unknown } } | null)?.overall;
    const healthy = res.ok && overall?.healthy === true;

    return { url, reachable: true, statusCode, healthy, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { url, reachable: false, healthy: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
