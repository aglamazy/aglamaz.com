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
