/**
 * Schedule-aware digest-delivery check (famcircle#144 follow-up).
 *
 * Replaces the naive "has anything gone out recently" staleness window
 * (emailVolumeCheck.ts) for the digest send specifically, per Buddy's review:
 * "size it to the actual send calendar - ask 'did the digest that was DUE
 * actually go', not 'has anything gone recently'." A quiet stretch near a
 * weekly/monthly boundary is normal; a digest period that fired with eligible
 * recipients and never produced a single send is not.
 *
 * Reuses resolveDigestRecipients (the exact function the real cron and the
 * admin preview call) so "eligible" and "sent" are computed by the same code
 * path production uses - no parallel reimplementation to drift out of sync.
 *
 * Firestore access is injected (DigestDeliveryCheckDeps) so this stays testable
 * without a live Firestore project, matching the fake-fetch pattern already
 * used by emailVolumeCheck.test.ts.
 */
import { lastWeeklyFireDate, lastMonthlyFireDate } from '@/services/DigestScheduleService';
import type { DigestCadence } from '@/repositories/DigestSendRepository';
import { periodKeyFor } from '@/repositories/DigestSendRepository';

export interface DigestDeliveryMiss {
  siteId: string;
  cadence: DigestCadence;
  periodKey: string;
  eligibleCount: number;
}

export interface DigestDeliverySiteError {
  siteId: string;
  cadence: DigestCadence;
  periodKey: string;
  error: string;
}

export interface DigestDeliveryCheckResult {
  healthy: boolean;
  checkedCadences: DigestCadence[];
  missing: DigestDeliveryMiss[];
  errors: DigestDeliverySiteError[];
}

export interface DigestDeliveryCheckDeps {
  /** Site ids with the digest send-type switched on (SiteRepository.resolveSendSettings(...).digest). */
  listDigestEnabledSiteIds(): Promise<string[]>;
  /** Members who want this cadence, regardless of dedup state (resolveDigestRecipients onlyUnsent:false). */
  countEligible(siteId: string, cadence: DigestCadence, periodKey: string): Promise<number>;
  /** Members who want this cadence and have NOT been marked sent yet (onlyUnsent:true). */
  countUnsent(siteId: string, cadence: DigestCadence, periodKey: string): Promise<number>;
}

/**
 * A cadence's most-recently-due period is only worth checking once its burst window has
 * had time to fully run (the cron retries for up to an hour - see cron/digest/route.ts's
 * header comment) plus slack for a delayed run. Checking too early would flag a period
 * that's still legitimately in-flight.
 */
const DEFAULT_GRACE_HOURS = 2;

export async function checkDigestDelivery(
  now: Date,
  deps: DigestDeliveryCheckDeps,
  graceHours = DEFAULT_GRACE_HOURS,
): Promise<DigestDeliveryCheckResult> {
  const graceMs = graceHours * 60 * 60 * 1000;
  const candidates: Array<{ cadence: DigestCadence; fireDate: Date }> = [
    { cadence: 'weekly', fireDate: lastWeeklyFireDate(now) },
    { cadence: 'monthly', fireDate: lastMonthlyFireDate(now) },
  ];
  const due = candidates.filter((c) => now.getTime() - c.fireDate.getTime() >= graceMs);

  const missing: DigestDeliveryMiss[] = [];
  const errors: DigestDeliverySiteError[] = [];

  if (due.length === 0) {
    return { healthy: true, checkedCadences: [], missing, errors };
  }

  const siteIds = await deps.listDigestEnabledSiteIds();

  for (const { cadence, fireDate } of due) {
    const periodKey = periodKeyFor(cadence, fireDate);
    for (const siteId of siteIds) {
      try {
        const eligibleCount = await deps.countEligible(siteId, cadence, periodKey);
        if (eligibleCount === 0) {
          // Nobody on this site wants this cadence this period - not a failure, mirrors
          // the real cron's own "nobody eligible" skip.
          continue;
        }
        const unsentCount = await deps.countUnsent(siteId, cadence, periodKey);
        if (unsentCount === eligibleCount) {
          // Every eligible member is still unsent for a period that has already fired -
          // nobody got through at all.
          missing.push({ siteId, cadence, periodKey, eligibleCount });
        }
      } catch (error) {
        errors.push({
          siteId,
          cadence,
          periodKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return {
    healthy: missing.length === 0 && errors.length === 0,
    checkedCadences: due.map((d) => d.cadence),
    missing,
    errors,
  };
}
