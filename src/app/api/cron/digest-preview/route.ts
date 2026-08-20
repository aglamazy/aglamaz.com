// Automatic 24h-before-send admin draft (Agla 2026-07-27): runs daily, and for each site
// where a real digest send is scheduled for TOMORROW (weekly on the Friday before, monthly
// on the day before the 1st), emails every site admin the same dress-rehearsal preview the
// manual "Send me a preview" button produces - so mistakes can be caught before the real
// send goes out, without anyone having to remember to click a button.
//
// Checks weekly and monthly independently (not "whichever fires next") so the rare case of
// the 1st-of-month landing on a Friday still previews both, matching how the real cron
// (vercel.json) also fires both independently on that day.
//
// Schedule: 0 6 * * * (06:00 UTC daily) - vercel.json. Same hour as the real weekly cron's
// burst start, so "the day before" lands at a sensible morning hour.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual
// curl tests, same pattern as every other cron in this app.
import { NextRequest, NextResponse } from 'next/server';
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { renderEmailHtml } from '@/services/emailTemplates';
import { nextWeeklyFireDate, nextMonthlyFireDate } from '@/services/DigestScheduleService';
import { buildDigestPreviewSection, sendDigestPreviewEmails, SiteDefaultLocaleMissingError } from '@/services/DigestPreviewRenderer';
import type { DigestCadence } from '@/repositories/DigestSendRepository';

export const dynamic = 'force-dynamic';

function isSameUtcDate(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/** Cadences whose real send is scheduled for tomorrow - checked independently so a 1st-of-month-on-Friday still previews both. */
function dueCadencesForTomorrow(now: Date): Array<{ cadence: DigestCadence; fireDate: Date }> {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const due: Array<{ cadence: DigestCadence; fireDate: Date }> = [];
  const weeklyFire = nextWeeklyFireDate(now);
  if (isSameUtcDate(weeklyFire, tomorrow)) due.push({ cadence: 'weekly', fireDate: weeklyFire });
  const monthlyFire = nextMonthlyFireDate(now);
  if (isSameUtcDate(monthlyFire, tomorrow)) due.push({ cadence: 'monthly', fireDate: monthlyFire });
  return due;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/digest-preview] CRON_SECRET environment variable is not set');
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

  const now = new Date();
  const due = dueCadencesForTomorrow(now);
  if (due.length === 0) {
    console.log('[cron/digest-preview] nothing due tomorrow, skipping');
    return NextResponse.json({ ok: true, due: [], sent: 0, failed: 0 });
  }

  const siteRepo = new SiteRepository();
  const memberRepo = new MemberRepository();
  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/digest-preview] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    for (const { cadence, fireDate } of due) {
      try {
        const admins = await memberRepo.listBySite(siteId, { roles: ['admin'] });
        const adminEmails = admins.map((a) => a.email).filter((e): e is string => !!e);
        if (adminEmails.length === 0) continue;

        const contextLine = `Rehearsing the real send scheduled for <strong>${fireDate.toISOString()}</strong> (tomorrow) - edit anything that looks wrong before it goes out.`;
        const { section, recipientCount } = await buildDigestPreviewSection(siteId, cadence, fireDate, contextLine);
        if (recipientCount === 0) continue; // nobody wants this cadence on this site - nothing to preview

        const html = renderEmailHtml({
          subject: `Digest preview - tomorrow's ${cadence} send`,
          lang: 'en',
          dir: 'ltr',
          heading: '🔍 Digest preview',
          greeting: `Automatic preview - your ${cadence} magazine sends tomorrow.`,
          paragraphs: [section],
          footerLines: ['This is a preview only - no one else was emailed, and nothing was marked as sent.'],
        });

        const result = await sendDigestPreviewEmails(
          adminEmails,
          `🔍 Tomorrow's ${cadence} magazine - preview`,
          html,
        );
        sent += result.sent;
        failed += result.failed;
        for (const e of result.errors) {
          console.error(`[cron/digest-preview] send failed site=${siteId} cadence=${cadence} to=${e.to}:`, e.error);
        }
      } catch (err) {
        if (err instanceof SiteDefaultLocaleMissingError) {
          console.error(`[cron/digest-preview] skipping site=${siteId}: ${err.message}`);
          continue;
        }
        failed++;
        console.error(`[cron/digest-preview] error processing site=${siteId} cadence=${cadence}:`, err);
      }
    }
  }

  console.log(`[cron/digest-preview] complete: due=${due.map((d) => d.cadence).join(',')} sites=${siteIds.length} sent=${sent} failed=${failed}`);
  // Honest status (Agla 2026-08-20): "preview receiving = cron will be received" - this
  // now runs the exact same sendDigestPreviewEmails() as digest-preview-send/route.ts
  // (the admin button), which fails loud with a real 500 on a Resend error. A total
  // failure here (every attempted send failed, nothing to show for the request) gets
  // the same honest 500 instead of the {ok:true} 200 that hid mail.famcircle.org's
  // domain-verification outage from every status-code-based check.
  const allFailed = failed > 0 && sent === 0;
  return NextResponse.json(
    { ok: failed === 0, due: due.map((d) => d.cadence), sent, failed },
    { status: allFailed ? 500 : 200 },
  );
}

// famcircle#160 (2026-08-16): report any non-2xx response (default: only 5xx) - a cron
// route rejecting its own scheduler's call (e.g. a 401 from a stale CRON_SECRET, the
// famcircle#156 incident) is never a normal "expected client error", unlike most 4xx
// traffic elsewhere in the app. Requires AGENTS_OBSERVE_INGEST_URL/TOKEN/PROJECT_ID to
// actually deliver - no-ops safely if unset (see docs/monitoring-runbook.md).
