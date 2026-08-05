#!/usr/bin/env tsx
/**
 * Email-channel dead-man's-switch (famcircle#144).
 *
 * Checks Resend's own send history (ground truth upstream of our tracking collection,
 * which only logs opens/clicks) for at least one email in the trailing window. Exits
 * 0/1 so it composes with the fleet's existing healthchecks.io dead-man's-switch
 * convention, same shape as scripts/uptime-check.ts.
 *
 * Built after a real 3-day (2026-07-25 to 07-27) total email-channel outage went
 * undetected for 10 days - discovered by accident, not by any monitoring. See
 * scripts/lib/emailVolumeCheck.ts for the floor/window reasoning.
 *
 * Usage:
 *   npx tsx scripts/check-email-volume.ts
 *   RESEND_VOLUME_WINDOW_HOURS=72 npx tsx scripts/check-email-volume.ts
 */
import { checkEmailVolume } from './lib/emailVolumeCheck';

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('check-email-volume: RESEND_API_KEY is not set.');
    process.exitCode = 1;
    return;
  }

  const windowHours = process.env.RESEND_VOLUME_WINDOW_HOURS
    ? parseInt(process.env.RESEND_VOLUME_WINDOW_HOURS, 10)
    : 48;

  const result = await checkEmailVolume(apiKey, windowHours);
  console.log(JSON.stringify(result));

  if (!result.healthy) {
    process.exitCode = 1;
  }
}

main();
