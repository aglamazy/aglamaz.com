#!/usr/bin/env tsx
/**
 * Email-channel dead-man's-switch (famcircle#144).
 *
 * Checks Resend's own send history (ground truth upstream of our tracking collection,
 * which only logs opens/clicks) for at least one email in the trailing window.
 *
 * Built after a real 3-day (2026-07-25 to 07-27) total email-channel outage went
 * undetected for 10 days - discovered by accident, not by any monitoring. See
 * scripts/lib/emailVolumeCheck.ts for the floor/window reasoning.
 *
 * Exit codes (famcircle#175, Buddy 2026-10-06) - the caller must be able to tell
 * "the email channel is dark" from "this check cannot see":
 *
 *   0  healthy      at least one email went out in the window
 *   1  DARK         Resend read fine and nothing went out - the real finding
 *   2  INOPERATIVE  could not read Resend (bad key scope, API down, no key set);
 *                   says nothing about the channel either way
 *
 * Both non-zero codes are still findings and still alert - the runner branches on
 * non-zero, so 2 is never silently swallowed. The split exists so three weeks of
 * "restricted_api_key" cannot masquerade as three weeks of email outage, which is
 * exactly what happened from 2026-09-13 until this change.
 *
 * Usage:
 *   npx tsx scripts/check-email-volume.ts
 *   RESEND_VOLUME_WINDOW_HOURS=72 npx tsx scripts/check-email-volume.ts
 */
import { checkEmailVolume, type EmailVolumeCheckResult } from './lib/emailVolumeCheck';

const EXIT_DARK = 1;
const EXIT_INOPERATIVE = 2;

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No key is inoperative, not dark: with nothing to ask Resend with, we have learned
    // nothing about the channel. Emitted as JSON too, so the archive line is parseable
    // whichever way the run failed.
    const result: EmailVolumeCheckResult = {
      healthy: false,
      state: 'inoperative',
      count: null,
      windowHours: 0,
      error: 'RESEND_API_KEY is not set',
    };
    console.log(JSON.stringify(result));
    console.error('check-email-volume: RESEND_API_KEY is not set.');
    process.exitCode = EXIT_INOPERATIVE;
    return;
  }

  const windowHours = process.env.RESEND_VOLUME_WINDOW_HOURS
    ? parseInt(process.env.RESEND_VOLUME_WINDOW_HOURS, 10)
    : 48;

  const result = await checkEmailVolume(apiKey, windowHours);
  console.log(JSON.stringify(result));

  if (result.state === 'inoperative') {
    process.exitCode = EXIT_INOPERATIVE;
  } else if (result.state === 'dark') {
    process.exitCode = EXIT_DARK;
  }
}

main();
