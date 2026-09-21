// famcircle#182: the dead-man ping helper's loud/quiet branches. The hub call itself (pingDeadman) is agents-observe's
// and is never exercised here - no test may ping a real hub.
import assert from 'node:assert/strict';
import { pingSendFlow } from '../src/services/DeadmanPing';

async function main() {
  const saved = { ...process.env };
  try {
    // Disabled deploy (preview / local): nothing is sent and a missing slug is fine.
    process.env.AGENTS_OBSERVE_DISABLED = '1';
    delete process.env.DEADMAN_SLUG_digest_weekly;
    await pingSendFlow('digest-weekly');

    // Enabled deploy with no slug: loud, and the message names the variable, never a value.
    delete process.env.AGENTS_OBSERVE_DISABLED;
    await assert.rejects(pingSendFlow('digest-weekly'), /DEADMAN_SLUG_digest_weekly is not set/);
    await assert.rejects(pingSendFlow('in-day-reminders'), /DEADMAN_SLUG_in_day_reminders is not set/);

    // "0" / "false" do not count as disabled.
    process.env.AGENTS_OBSERVE_DISABLED = 'false';
    await assert.rejects(pingSendFlow('digest-monthly'), /DEADMAN_SLUG_digest_monthly is not set/);
  } finally {
    process.env = saved;
  }
  console.log('deadmanPing.test: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
