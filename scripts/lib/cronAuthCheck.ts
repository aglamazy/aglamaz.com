/**
 * Cron-auth dead-man's-switch (famcircle#160, generalized for famcircle#161's
 * `npm run test:deploy` per-route requirement). Born from the 2026-08-11 CRON_SECRET
 * incident (famcircle#156): all 5 Vercel cron routes silently 401'd for 4 days, because
 * the already-deployed function baked the pre-rotation secret and no code path noticed.
 *
 * No app code can detect this from the inside - a deployed function has no way to know
 * its own baked env value is stale relative to the dashboard. It can only be caught
 * from OUTSIDE: make a real request using the CURRENTLY-CONFIGURED secret and see
 * whether the deployment actually accepts it.
 */

export interface CronAuthCheckResult {
  route: string;
  healthy: boolean;
  reachable: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * One probe per cron route, each with a scoping param that proves auth succeeded
 * without triggering the route's real side effect:
 *  - digest / in-day-reminders: memberId=<nonexistent> (route-native no-op filter)
 *  - blog-autogen / digest-preview / yahrzeit-whatsapp: dryRun=true (famcircle#161 -
 *    short-circuits AFTER the auth check, BEFORE any AI draft / email / WhatsApp send)
 */
export const CRON_PROBES: ReadonlyArray<{ route: string; query: string }> = [
  { route: '/api/cron/digest', query: 'cadence=weekly&memberId=__cron-auth-check-canary__' },
  { route: '/api/cron/in-day-reminders', query: 'memberId=__cron-auth-check-canary__' },
  { route: '/api/cron/blog-autogen', query: 'dryRun=true' },
  { route: '/api/cron/digest-preview', query: 'dryRun=true' },
  { route: '/api/cron/yahrzeit-whatsapp', query: 'dryRun=true' },
];

async function probeOne(baseUrl: string, route: string, query: string, secret: string, timeoutMs: number): Promise<CronAuthCheckResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}${route}?${query}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    return { route, healthy: res.status === 200, reachable: true, statusCode: res.status };
  } catch (error) {
    return {
      route,
      healthy: false,
      reachable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Single-route check - kept for callers that only care about one canary (e.g. a quick manual probe). */
export async function checkCronAuth(baseUrl: string, secret: string, timeoutMs = 10_000): Promise<CronAuthCheckResult> {
  return probeOne(baseUrl, CRON_PROBES[0].route, CRON_PROBES[0].query, secret, timeoutMs);
}

/** All 5 cron routes, each probed individually (famcircle#161) - catches a route-specific auth bug, not just the shared secret. */
export async function checkAllCronAuth(baseUrl: string, secret: string, timeoutMs = 10_000): Promise<CronAuthCheckResult[]> {
  return Promise.all(CRON_PROBES.map((p) => probeOne(baseUrl, p.route, p.query, secret, timeoutMs)));
}
