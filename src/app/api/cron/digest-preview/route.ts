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
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml } from '@/services/emailTemplates';
import { nextWeeklyFireDate, nextMonthlyFireDate } from '@/services/DigestScheduleService';
import { buildDigestPreviewSection, SiteDefaultLocaleMissingError } from '@/services/DigestPreviewRenderer';
import type { DigestCadence } from '@/repositories/DigestSendRepository';
import { reportCronAuthFailure } from '@/lib/reportCronAuthFailure';

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
    reportCronAuthFailure('/api/cron/digest-preview');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        const results = await Promise.allSettled(
          adminEmails.map((to) =>
            ResendService.sendTransactionalEmail({ to, subject: `🔍 Tomorrow's ${cadence} magazine - preview`, html, lang: 'en' }),
          ),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') sent++;
          else {
            failed++;
            console.error(`[cron/digest-preview] send failed site=${siteId} cadence=${cadence}:`, r.reason);
          }
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
  return NextResponse.json({ ok: true, due: due.map((d) => d.cadence), sent, failed });
}
