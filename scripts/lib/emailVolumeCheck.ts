/**
 * Core email-volume-check logic (famcircle#144), factored out so tests can exercise it
 * against a fake fetch without a real Resend API call.
 */

export interface EmailVolumeCheckResult {
  healthy: boolean;
  count: number;
  windowHours: number;
  error?: string;
}

/**
 * Resend's own /emails list, most-recent-first (confirmed by direct API use investigating
 * famcircle#144's 3-day outage) - the only ground truth upstream of our own tracking
 * collection, which only logs opens/clicks, never sends. "Healthy" means at least one email
 * was sent in the trailing windowHours - not a rate check, a dead-man's-switch.
 *
 * Window calibrated EMPIRICALLY, not just from the cron schedule (2026-08-05, this check's
 * own first live run): the original 48h default false-positived on a genuinely healthy
 * quiet stretch (2026-08-03 02:29 to 2026-08-05 20:00, ~66h and still climbing toward the
 * next Thursday digest-preview) - /api/health was fully green, every cron still correctly
 * registered, no real problem. Gaps approaching 4 days can be entirely normal near a
 * weekly-digest boundary even though the digest cadence itself is a single global Friday
 * burst (see DigestScheduleService.nextWeeklyFireDate) - other send types (in-day
 * reminders, blog-autogen, ad hoc admin sends) don't share that fixed schedule, so a quiet
 * stretch on THIS check doesn't mean "the digest didn't fire", just "nothing on any
 * channel fired". 96h still catches a multi-day total outage (the actual failure mode
 * found 2026-08-05: 72h of zero activity, discovered by accident 10 days later) within
 * about a day of it exceeding normal patterns, while tolerating the real quiet stretches
 * this fires against. Still empirical, not proven optimal - if this starts missing real
 * gaps or still false-positiving, recalibrate against fresh Resend history rather than
 * guessing again. For the digest specifically, prefer check-digest-delivery.ts (schedule-
 * aware, checks the actual due period rather than a rolling window) over widening this one.
 */
export async function checkEmailVolume(apiKey: string, windowHours = 96): Promise<EmailVolumeCheckResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { healthy: false, count: 0, windowHours, error: `Resend API ${res.status}: ${body.slice(0, 200)}` };
    }
    const body = (await res.json()) as { data?: Array<{ created_at: string }> };
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const count = (body.data ?? []).filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
    return { healthy: count > 0, count, windowHours };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { healthy: false, count: 0, windowHours, error: message };
  }
}
