/**
 * Core email-volume-check logic (famcircle#144), factored out so tests can exercise it
 * against a fake fetch without a real Resend API call.
 */

/**
 * Why three states and not a boolean (famcircle#175, Buddy 2026-10-06):
 *
 *   healthy      we read Resend and at least one email went out in the window
 *   dark         we read Resend and NOTHING went out in the window - the real finding
 *   inoperative  we could not read Resend at all, so we learned nothing either way
 *
 * The old shape collapsed the last two into `healthy: false, count: 0`, which reads as
 * "the channel is dark". That is what it reported continuously from 2026-09-13 to
 * 2026-10-06: the configured key is send-only, GET /emails answered 401
 * restricted_api_key, and every run alarmed about an email outage that was not
 * happening. Three weeks of a dead-man's-switch crying wolf is a dead-man's-switch
 * nobody reads - and this one exists because a real 3-day outage went undetected for
 * 10 days (2026-07-25 to 07-27). Losing it to its own noise is the one failure it
 * cannot afford, so "I cannot tell" now says so instead of guessing the alarming
 * answer.
 *
 * `count` is null when inoperative, deliberately: a number there is a claim about how
 * many emails were sent, and we did not get to find out. `healthy` is kept as a
 * boolean for the archive readers that already key on it.
 */
export type EmailVolumeCheckState = 'healthy' | 'dark' | 'inoperative';

export interface EmailVolumeCheckResult {
  healthy: boolean;
  state: EmailVolumeCheckState;
  /** Emails seen in the window; null when inoperative - we never read the list. */
  count: number | null;
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
 * The default was 96 here until 2026-10-06 while every caller passed 48 and this very
 * docstring argued 48 was essential - inert, but a trap for anyone running it by hand.
 * It is 48 now; the argument above is the reason.
 *
 * The real fix for the digest specifically is scripts/check-digest-delivery.ts
 * (schedule-aware: "did the period that was DUE actually go", not "has anything gone
 * recently") - this check stays in place as the floor for the OTHER send types (in-day
 * reminders, blog-autogen, ad hoc admin sends) that don't have a fixed schedule to check
 * against, AND as a backstop against the case where every site's due period had zero
 * eligible recipients (so the precise per-period check would correctly report healthy
 * while the whole channel is still actually dark) - see docs/monitoring-runbook.md. Run
 * both; neither one alone covers everything the other does.
 *
 * It is also NOT made redundant by famcircle#182's dead-man pings: those fire when
 * `failed === 0 && skipped === 0`, which a run with nothing to send satisfies. Every
 * signal reads green on a deploy where zero emails reach anyone. The pings prove the cron
 * ran and Resend accepted what was attempted; only this check notices that nothing was
 * attempted.
 */
export async function checkEmailVolume(apiKey: string, windowHours = 48): Promise<EmailVolumeCheckResult> {
  const inoperative = (error: string): EmailVolumeCheckResult => ({
    healthy: false,
    state: 'inoperative',
    count: null,
    windowHours,
    error,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return inoperative(`Resend API ${res.status}: ${body.slice(0, 200)}`);
    }

    const body = (await res.json().catch(() => null)) as { data?: Array<{ created_at: string }> } | null;
    // A 200 whose body is not the shape we expect is also "we learned nothing" - the old
    // code read `body.data ?? []` and reported a confident count 0, so an HTML error page
    // or a changed API contract would have been indistinguishable from a dark channel.
    if (!body || !Array.isArray(body.data)) {
      return inoperative('Resend API 200 but the body had no data array - cannot determine volume');
    }

    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const count = body.data.filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
    return { healthy: count > 0, state: count > 0 ? 'healthy' : 'dark', count, windowHours };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return inoperative(message);
  }
}
