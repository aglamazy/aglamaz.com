// Shared "which cadence, as of when" logic - used by the admin preview endpoint (both
// 'scheduled' and 'now' modes) and the admin publish-now endpoint, so all three agree on
// what "today's cadence" means (Agla, 2026-07-24).
import type { DigestCadence } from '@/repositories/DigestSendRepository';

/** Next Friday 06:00 UTC - matches vercel.json's weekly burst window start. */
export function nextWeeklyFireDate(now: Date): Date {
  const daysUntilFriday = (5 - now.getUTCDay() + 7) % 7;
  const burstStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFriday, 6, 0, 0));
  if (daysUntilFriday === 0 && now.getTime() >= burstStart.getTime()) {
    burstStart.setUTCDate(burstStart.getUTCDate() + 7);
  }
  return burstStart;
}

/** Next 1st-of-month 00:00 UTC - matches vercel.json's monthly burst window start. */
export function nextMonthlyFireDate(now: Date): Date {
  const burstStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  if (now.getTime() >= burstStart.getTime()) {
    burstStart.setUTCMonth(burstStart.getUTCMonth() + 1);
  }
  return burstStart;
}

/**
 * Which cadence is actually next to fire - not "both, always" (that caused a "duplicate"
 * confusion: monthly's window contains weekly's, so showing both unconditionally just
 * repeats the same near-term events twice in one preview). Whichever burst is
 * chronologically closer is "the right one" - Thursday -> weekly (fires Friday), day before
 * the 1st -> monthly (fires the 1st), and this generalizes cleanly to any day.
 */
export function nextCadenceToFire(now: Date): { cadence: DigestCadence; fireDate: Date } {
  const weeklyFire = nextWeeklyFireDate(now);
  const monthlyFire = nextMonthlyFireDate(now);
  return weeklyFire.getTime() <= monthlyFire.getTime()
    ? { cadence: 'weekly', fireDate: weeklyFire }
    : { cadence: 'monthly', fireDate: monthlyFire };
}

/**
 * The most recent weekly burst start that has already happened (today's, if today is
 * Friday at/after 06:00 UTC and the burst has already run). famcircle#144's monitoring
 * follow-up: nextWeeklyFireDate always looks forward, but a schedule-aware health check
 * needs to ask "was the period that already fired actually delivered" - derived as
 * nextWeeklyFireDate minus one cycle, which nextWeeklyFireDate's own same-day rollover
 * already makes correct in both the "today is fire day" and "today is any other day" cases.
 */
export function lastWeeklyFireDate(now: Date): Date {
  const next = nextWeeklyFireDate(now);
  return new Date(next.getTime() - 7 * 24 * 60 * 60 * 1000);
}

/** Same derivation as lastWeeklyFireDate, for the monthly cadence. */
export function lastMonthlyFireDate(now: Date): Date {
  const next = nextMonthlyFireDate(now);
  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() - 1, 1, 0, 0, 0));
}
