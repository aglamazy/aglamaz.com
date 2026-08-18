/**
 * Cron-registration check (famcircle#161 follow-up, 2026-08-18) - the gap Agla named
 * directly and the fleet's control-proof-principle names in general
 * (~/develop/Buddy/docs/control-proof-principle.md, found the same night this was
 * built): "a control must prove the STATE, not the ACTION."
 *
 * checkAllCronAuth (cronAuthCheck.ts) proves an ACTION: "if I call this route right now
 * with the current secret, it accepts the call." That is NOT proof Vercel's own cron
 * scheduler will ever actually call it - if the entry were silently removed from
 * vercel.json (or never deployed, or Vercel's cron feature got disabled for the
 * project), checkAllCronAuth would keep reporting healthy forever, because a human/script
 * calling the route manually is indistinguishable from the real trigger existing at all.
 *
 * This checks the STATE directly: does Vercel's live project registration actually list
 * each expected {path, schedule} pair? That's the guarantee whose absence is famcircle
 * #156's real failure mode one layer up - not "the secret is stale" but "nothing is
 * configured to call this at all."
 */

export interface ExpectedCronEntry {
  path: string;
  schedule: string;
}

export interface RegisteredCronEntry {
  path: string;
  schedule: string;
}

export interface CronRegistrationResult {
  healthy: boolean;
  missing: ExpectedCronEntry[];
  scheduleMismatches: Array<{ path: string; expected: string; registered: string }>;
}

export interface CronRegistrationDeps {
  /** The cron entries Vercel currently has registered for this project (its OWN state, not a manual probe). */
  fetchRegisteredCrons(): Promise<RegisteredCronEntry[]>;
}

export async function checkCronRegistration(
  expected: ExpectedCronEntry[],
  deps: CronRegistrationDeps,
): Promise<CronRegistrationResult> {
  const registered = await deps.fetchRegisteredCrons();
  // A path can legitimately have more than one schedule (digest fires on both a burst
  // window AND a final catch-all) - match by (path, schedule) pair, not path alone.
  const registeredSet = new Set(registered.map((r) => `${r.path}::${r.schedule}`));

  const missing: ExpectedCronEntry[] = [];
  const scheduleMismatches: CronRegistrationResult['scheduleMismatches'] = [];

  for (const entry of expected) {
    if (registeredSet.has(`${entry.path}::${entry.schedule}`)) continue;
    const sameSchedulesForPath = registered.filter((r) => r.path === entry.path);
    if (sameSchedulesForPath.length > 0) {
      scheduleMismatches.push({ path: entry.path, expected: entry.schedule, registered: sameSchedulesForPath.map((r) => r.schedule).join(' | ') });
    } else {
      missing.push(entry);
    }
  }

  return { healthy: missing.length === 0 && scheduleMismatches.length === 0, missing, scheduleMismatches };
}
