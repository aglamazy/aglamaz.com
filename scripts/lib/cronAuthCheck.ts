/**
 * Cron-auth dead-man's-switch (famcircle#160, born from the 2026-08-11 CRON_SECRET
 * incident - famcircle#156: all 5 Vercel cron routes silently 401'd for 4 days after a
 * secret rotation, because the already-deployed function baked the pre-rotation value
 * and no code path noticed).
 *
 * No app code can detect this from the inside - a deployed function has no way to know
 * its own baked env value is stale relative to the dashboard. It can only be caught
 * from OUTSIDE: make a real request using the CURRENTLY-CONFIGURED secret and see
 * whether the deployment actually accepts it.
 */

export interface CronAuthCheckResult {
  healthy: boolean;
  reachable: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Hits the digest cron route as the canary - all 5 cron routes share the identical
 * CRON_SECRET check and the same deployment, so one route's auth result generalizes to
 * all of them. memberId is scoped to a value that cannot match a real member, making
 * this call a safe no-op even on a 200 (no real send happens - see
 * src/app/api/cron/digest/route.ts's memberIdFilter handling).
 */
export async function checkCronAuth(baseUrl: string, secret: string, timeoutMs = 10_000): Promise<CronAuthCheckResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/cron/digest?cadence=weekly&memberId=__cron-auth-check-canary__`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    return { healthy: res.status === 200, reachable: true, statusCode: res.status };
  } catch (error) {
    return {
      healthy: false,
      reachable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timer);
  }
}
