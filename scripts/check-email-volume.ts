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
 * Key (custodian#118): prefers RESEND_FAMCIRCLE_READ_KEY, a read-scoped reporting key
 * minted separately from the app's send key. Listing /emails needs read scope, which the
 * production send key deliberately does not have - widening that key to satisfy a monitor
 * would hand read scope to the credential the live app sends with. The read key lives in
 * its own custody file (Buddy secrets/env/famcircle-resend-read.env, exported by the
 * runner as of Buddy e9382454) specifically so the Vercel env sync never carries it into
 * production. Falls back to RESEND_API_KEY so nothing breaks before the key is minted -
 * that fallback just reports INOPERATIVE, which is the honest answer.
 *
 * Usage:
 *   npx tsx scripts/check-email-volume.ts
 *   RESEND_VOLUME_WINDOW_HOURS=72 npx tsx scripts/check-email-volume.ts
 */
import { checkEmailVolume, type EmailVolumeCheckResult } from './lib/emailVolumeCheck';

const EXIT_DARK = 1;
const EXIT_INOPERATIVE = 2;

async function main() {
  const apiKey = process.env.RESEND_FAMCIRCLE_READ_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No key is inoperative, not dark: with nothing to ask Resend with, we have learned
    // nothing about the channel. Emitted as JSON too, so the archive line is parseable
    // whichever way the run failed.
    const result: EmailVolumeCheckResult = {
      healthy: false,
      state: 'inoperative',
      count: null,
      windowHours: 0,
      error: 'neither RESEND_FAMCIRCLE_READ_KEY nor RESEND_API_KEY is set',
    };
    console.log(JSON.stringify(result));
    console.error('check-email-volume: no key - set RESEND_FAMCIRCLE_READ_KEY (preferred) or RESEND_API_KEY.');
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
