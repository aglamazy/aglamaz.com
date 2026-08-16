// Digest cron: compile a digest per member's magazineCadence preference and send it
// directly (per-member, via Resend) - not a single site-wide Listmonk campaign.
// Per docs/family-digest-formats-spec.md §1: cadence is a per-member choice
// ('weekly' | 'monthly' | 'none'), resolved at send time, from ONE shared route.
// Four cron entries point at this same route (see vercel.json) - a burst of 7 fires every
// 10 minutes for an hour after the base time, not spread across the day (Agla, 2026-07-24
// - the "3 of 11" incident: any single run can be interrupted by a deploy cutover, timeout,
// or partial failure; DigestSendRepository's per-period dedup makes this cheap - each
// later fire is a near-no-op for whoever already got it, "broadcast" only reaches
// whoever's still missing, so tight retries converge to 100% within the hour):
//   - "0,10,20,30,40,50 0 1 * *" + "0 1 1 * *"   -> monthly (default, no query param): 00:00-01:00 UTC on the 1st
//   - "0,10,20,30,40,50 6 * * 5" + "0 7 * * 5"   -> weekly (rolling window): 06:00-07:00 UTC Friday
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { withServiceCall } from 'agents-observe/next';
import { SiteRepository } from '@/repositories/SiteRepository';
import { periodKeyFor } from '@/repositories/DigestSendRepository';
import { resolveDigestRecipients } from '@/services/DigestSendPlanService';
import { executeDigestSend } from '@/services/DigestSendExecutionService';
import type { UnifiedMagazineCadence } from '@/repositories/NotificationPreferencesRepository';

export const dynamic = 'force-dynamic';

type SendableCadence = Exclude<UnifiedMagazineCadence, 'none'>;

function resolveCadence(request: NextRequest): SendableCadence {
  return request.nextUrl.searchParams.get('cadence') === 'weekly' ? 'weekly' : 'monthly';
}

/** Optional single-recipient scope for manual real-path verification (avoids emailing the whole site). */
function resolveMemberIdFilter(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('memberId');
}

async function getHandler(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/digest] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteRepo = new SiteRepository();
  const cadence = resolveCadence(request);
  const memberIdFilter = resolveMemberIdFilter(request);

  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/digest] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  const now = new Date();
  const period = periodKeyFor(cadence, now);

  let sent = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      // F7-A (famcircle#119): the admin send-settings table is the ONE thing every send
      // route checks before firing - a site with digest switched off skips before any
      // member/prefs reads, same as the "nobody eligible" skip below.
      const siteForSendCheck = await siteRepo.get(siteId);
      if (!siteForSendCheck) {
        continue;
      }
      if (!siteRepo.resolveSendSettings(siteForSendCheck).digest) {
        console.log(`[cron/digest] skipped (send-settings off): site=${siteId}`);
        continue;
      }

      // Idempotency (Agla, 2026-07-24 - the "3 of 11" incident): this cron is scheduled to
      // fire multiple times per period specifically so an interrupted run (deploy cutover,
      // timeout, partial failure) gets picked up by the next fire - onlyUnsent filters out
      // already-sent members, so re-running is always safe and never double-sends. Locale
      // resolution (member.defaultLocale -> site.defaultLocale, no further guess) lives in
      // resolveDigestRecipients - shared with the admin preview endpoint.
      const { site, recipients } = await resolveDigestRecipients(siteId, cadence, period, {
        onlyUnsent: true,
        memberIdFilter,
      });

      if (recipients.length === 0) {
        // Nobody left to send to this run (either no one wants this cadence, or everyone
        // who does already got it this period) - skip compiling entirely.
        continue;
      }

      const result = await executeDigestSend(siteId, cadence, period, now, site, recipients);
      sent += result.sent;
      failed += result.failed;
      for (const { memberId, error } of result.errors) {
        console.error(`[cron/digest] error sending to member=${memberId} site=${siteId}:`, error);
      }

      console.log(
        `[cron/digest] sent: site=${siteId} cadence=${cadence} recipients=${recipients.length} siteDefaultLocale=${site.defaultLocale}`,
      );
    } catch (err) {
      failed++;
      console.error(`[cron/digest] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[cron/digest] complete: cadence=${cadence} sites=${siteIds.length} sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, cadence, sites: siteIds.length, sent, failed });
}

// famcircle#160 (2026-08-16): report any non-2xx response (default: only 5xx) - a cron
// route rejecting its own scheduler's call (e.g. a 401 from a stale CRON_SECRET, the
// famcircle#156 incident) is never a normal "expected client error", unlike most 4xx
// traffic elsewhere in the app. Requires AGENTS_OBSERVE_INGEST_URL/TOKEN/PROJECT_ID to
// actually deliver - no-ops safely if unset (see docs/monitoring-runbook.md).
export const GET = withServiceCall(getHandler, { report4xx: true });
