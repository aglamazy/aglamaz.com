// famcircle#182 (Agla, 2026-09-21): every scheduled send flow pings Cockpit's dead-man hub, and only after
// its emails were really accepted by Resend. No ping -> the check goes late -> Cockpit alerts, which covers
// a dead key, a failed send and a cron that never ran with one mechanism.
//
// The checks are registered at production build by scripts/register-deadman.mjs (deadman.signals.json holds
// the logical names). The slug of each is the Production-only sensitive env var DEADMAN_SLUG_<name with - as _>;
// it is a credential, never logged or put in a message.
import { pingDeadman } from 'agents-observe';

export type DeadmanSignal = 'digest-weekly' | 'digest-monthly' | 'in-day-reminders';

function isDisabled(): boolean {
  const v = (process.env.AGENTS_OBSERVE_DISABLED ?? '').trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false';
}

/**
 * Call at the END of a run in which every attempted send was delivered (Resend answered 2xx) - never at
 * the start, never after a failure. A missing slug on an enabled deploy throws: an unmonitored send flow
 * must be loud, not silently unwatched. The ping itself never throws (a hub outage cannot fail the cron).
 */
export async function pingSendFlow(signal: DeadmanSignal): Promise<void> {
  if (isDisabled()) return;
  const envName = `DEADMAN_SLUG_${signal.replace(/-/g, '_')}`;
  const slug = process.env[envName];
  if (!slug) {
    throw new Error(`[DeadmanPing] ${envName} is not set - the ${signal} dead-man ping cannot be sent`);
  }
  // await: a Vercel function can end right after the response, and a lost ping reads as a late check.
  await pingDeadman(slug, { await: true });
}
