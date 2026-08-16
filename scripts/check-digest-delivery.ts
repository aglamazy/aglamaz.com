#!/usr/bin/env tsx
/**
 * Digest-delivery dead-man's-switch (famcircle#144 follow-up).
 *
 * Schedule-aware: asks "did the digest period that already fired actually reach its
 * eligible recipients" rather than check-email-volume.ts's blunter "has anything gone
 * out recently" staleness window. Built after Buddy rejected widening that window as
 * "moves the blind spot rather than fixing the design flaw" - a real gap approaching a
 * weekly/monthly boundary is normal, a fired period with eligible recipients and zero
 * sends is not, and the two are indistinguishable from a flat count alone.
 *
 * Reuses resolveDigestRecipients - the same function the real cron and the admin
 * preview endpoint call - so "eligible" and "sent" match production exactly.
 *
 * Usage:
 *   npx tsx scripts/check-digest-delivery.ts
 *   DIGEST_DELIVERY_GRACE_HOURS=4 npx tsx scripts/check-digest-delivery.ts
 */
import { SiteRepository } from '@/repositories/SiteRepository';
import { resolveDigestRecipients } from '@/services/DigestSendPlanService';
import type { DigestCadence } from '@/repositories/DigestSendRepository';
import { checkDigestDelivery, type DigestDeliveryCheckDeps } from './lib/digestDeliveryCheck';

async function main() {
  const graceHours = process.env.DIGEST_DELIVERY_GRACE_HOURS
    ? parseInt(process.env.DIGEST_DELIVERY_GRACE_HOURS, 10)
    : undefined;

  const siteRepo = new SiteRepository();

  const deps: DigestDeliveryCheckDeps = {
    async listDigestEnabledSiteIds(): Promise<string[]> {
      const siteIds = await siteRepo.listAllSiteIds();
      const enabled: string[] = [];
      for (const siteId of siteIds) {
        const site = await siteRepo.get(siteId);
        if (site && siteRepo.resolveSendSettings(site).digest) {
          enabled.push(siteId);
        }
      }
      return enabled;
    },
    async countEligible(siteId: string, cadence: DigestCadence, periodKey: string): Promise<number> {
      const { recipients } = await resolveDigestRecipients(siteId, cadence, periodKey, { onlyUnsent: false });
      return recipients.length;
    },
    async countUnsent(siteId: string, cadence: DigestCadence, periodKey: string): Promise<number> {
      const { recipients } = await resolveDigestRecipients(siteId, cadence, periodKey, { onlyUnsent: true });
      return recipients.length;
    },
  };

  const result = await checkDigestDelivery(new Date(), deps, graceHours);
  console.log(JSON.stringify(result));

  if (!result.healthy) {
    process.exitCode = 1;
  }
}

main();
