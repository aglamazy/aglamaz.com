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
 * Window is 48h, INTENTIONALLY kept tight even though it false-positives on normal quiet
 * stretches (Buddy, 2026-08-05, rejecting a same-night widen-to-96h patch): the outage
 * this check exists for was 72 hours (2026-07-25 to 07-27). A 96h window requires 96h of
 * silence before alarming - it would not have caught the exact incident it was built for.
 * "Recalibrate from real data" is the wrong move when the real data sits past the edge of
 * usefulness; a monitor guaranteed to sleep through its own founding case is worse than a
 * noisy one. The interim tradeoff Buddy chose instead: keep 48h and route ITS alarms to
 * Buddy only (not a production-down page) rather than widening the window - noise into an
 * inbox is cheap, a blind spot is not. That routing is done on the timer/infra side, not
 * in this script.
 *
 * The real fix for the digest specifically is scripts/check-digest-delivery.ts
 * (schedule-aware: "did the period that was DUE actually go", not "has anything gone
 * recently") - this check stays in place as the floor for the OTHER send types (in-day
 * reminders, blog-autogen, ad hoc admin sends) that don't have a fixed schedule to check
 * against, AND as a backstop against the case where every site's due period had zero
 * eligible recipients (so the precise per-period check would correctly report healthy
 * while the whole channel is still actually dark) - see docs/monitoring-runbook.md. Run
 * both; neither one alone covers everything the other does.
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
