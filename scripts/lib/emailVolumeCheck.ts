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
 * was sent in the trailing windowHours - not a rate check, a dead-man's-switch: FamCircle's
 * schedule guarantees at least a weekly-digest-preview + the real weekly digest every
 * Thursday/Friday, so a 48h floor tolerates normal quiet days while still catching a
 * multi-day total outage (the actual failure mode found 2026-08-05: 72h of zero activity,
 * discovered by accident 10 days later) well within a day of it starting.
 */
export async function checkEmailVolume(apiKey: string, windowHours = 48): Promise<EmailVolumeCheckResult> {
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
