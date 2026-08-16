// Blog-autogen cron: once a month, draft ONE AI-authored blog post per site from that
// site's real recent family activity (the same past-month window DigestCompilerService
// already feeds to the monthly email digest - see BlogAutogenService), then route it into
// the EXISTING draft -> in_review -> published workflow (BlogRepository.requestReview /
// src/app/review/[token] / ReviewPostView) so a human family admin always approves before
// anything is public. This route/service never writes status:'published' directly.
// Schedule: "0 4 2 * *" (04:00 UTC on the 2nd of the month) - configured in vercel.json,
// after the monthly digest's 00:00-01:00 UTC window on the 1st, so the past-month data is
// stable when this runs.
// Idempotency (Agla, 2026-07-24 - the digest cron's "3 of 11" incident, same reasoning
// applies here): Vercel Cron can fire a schedule multiple times in a burst.
// BlogAutogenRepository's per-site-per-period dedup (mirroring DigestSendRepository)
// makes a re-fire a safe no-op instead of a duplicate draft.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for
// manual curl tests.

import { NextRequest, NextResponse } from 'next/server';
import { withServiceCall } from 'agents-observe/next';
import { SiteRepository } from '@/repositories/SiteRepository';
import { BlogAutogenService } from '@/services/BlogAutogenService';

export const dynamic = 'force-dynamic';

async function getHandler(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/blog-autogen] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // famcircle#161 (AI-12 test:deploy): a safe way to verify auth succeeds without
  // triggering the real side effect (an AI draft, a WhatsApp send, a preview email) -
  // short-circuits AFTER the auth check (so it still proves the secret is live) but
  // BEFORE any business logic runs.
  if (request.nextUrl.searchParams.get('dryRun') === 'true') {
    return NextResponse.json({ ok: true, dryRun: true });
  }

  const siteRepo = new SiteRepository();
  const service = new BlogAutogenService();

  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/blog-autogen] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  const now = new Date();

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    try {
      const result = await service.generateForSite(siteId, now);
      if (result.outcome === 'created') {
        ok++;
        console.log(`[cron/blog-autogen] created: site=${siteId} period=${result.periodKey} post=${result.postId}`);
      } else {
        skipped++;
        console.log(`[cron/blog-autogen] skipped: site=${siteId} period=${result.periodKey} reason=${result.outcome}`);
      }
    } catch (err) {
      failed++;
      console.error(`[cron/blog-autogen] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[cron/blog-autogen] complete: sites=${siteIds.length} ok=${ok} skipped=${skipped} failed=${failed}`);
  return NextResponse.json({ ok, skipped, failed, sites: siteIds.length });
}

// famcircle#160 (2026-08-16): report any non-2xx response (default: only 5xx) - a cron
// route rejecting its own scheduler's call (e.g. a 401 from a stale CRON_SECRET, the
// famcircle#156 incident) is never a normal "expected client error", unlike most 4xx
// traffic elsewhere in the app. Requires AGENTS_OBSERVE_INGEST_URL/TOKEN/PROJECT_ID to
// actually deliver - no-ops safely if unset (see docs/monitoring-runbook.md).
export const GET = withServiceCall(getHandler, { report4xx: true });
