// famcircle#160/#171 (Medic contract, msg 58508): a cron route rejecting its own scheduler's
// call (a stale/rotated CRON_SECRET, the famcircle#156 incident) is a distinct, actionable signal,
// not a generic 4xx - Medic asked for `error_class: "cron-scheduler-rejected"` so it doesn't
// bucket under withServiceCall's generic "client-error" fallback.
//
// Reported explicitly here (not via withServiceCall's report4xx) so this one known case gets its
// own error_class; withServiceCall still covers thrown errors and any other unexpected 5xx.
import { after } from 'next/server';
import { reportFault } from 'agents-observe';

/** Call right before returning 401 for a scheduler-auth mismatch. Never throws, never blocks. */
export function reportCronSchedulerRejected(route: string): void {
  after(
    reportFault({
      status: 401,
      route,
      error_class: 'cron-scheduler-rejected',
      message: 'cron route rejected its own scheduler call (CRON_SECRET mismatch)',
    }, { await: true }).catch(() => undefined),
  );
}
