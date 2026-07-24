// Digest preview cron: ~24h before the real digest send (src/app/api/cron/digest/route.ts)
// fires for a cadence, email the site's admin/owner a preview of the compiled digest PLUS
// a plain recipient/locale table - a pre-flight check that would have caught the
// 2026-07-24 "Arabic digest" incident (13 members got the wrong language) before it reached
// anyone. Purely informational: never blocks or alters the real send.
//
// Runs DAILY (see vercel.json) and self-gates on "is tomorrow (UTC) one of the real send's
// scheduled fire dates" - monthly fires 00:00 UTC on the 1st, weekly fires 06:00 UTC every
// Friday - rather than trying to hand-derive a once-a-month/once-a-week cron expression for
// "the day before the 1st" (month lengths vary). Dedup is per site+cadence+period via
// DigestPreviewSendRepository, mirroring the hasSent/markSent shape already used by
// ReminderSendsRepository / WhatsAppYahrzeitSendRepository - this is REQUIRED, not
// defensive, since a daily-running cron would otherwise re-preview every day the gate holds
// true if it ever holds true for more than one run (retries, clock drift).
//
// Recipient/locale resolution reuses resolveDigestSendPlan (@/services/DigestRecipientResolver)
// - the SAME function the real send cron calls - so this preview cannot drift from what
// actually gets sent.
import { NextRequest, NextResponse } from 'next/server';
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { escapeHtml } from '@/services/emailTemplates';
import { normalizeLang } from '@/services/LocalizationService';
import { adminAuth } from '@/firebase/admin';
import {
  resolveDigestSendPlan,
  DIGEST_SOURCE_LOCALE,
  type SendableDigestCadence,
  type DigestRecipient,
} from '@/services/DigestRecipientResolver';
import { DigestPreviewSendRepository } from '@/repositories/DigestPreviewSendRepository';

export const dynamic = 'force-dynamic';

interface PreviewTarget {
  cadence: SendableDigestCadence;
  /** The UTC calendar date the real send is scheduled to fire. */
  targetDate: Date;
  /** Dedup key for DigestPreviewSendRepository - one preview per site per period. */
  periodKey: string;
}

function toUtcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** Real schedule per vercel.json: monthly = "0 0 1 * *", weekly = "0 6 * * 5" (Friday). */
function resolvePreviewTargets(now: Date): PreviewTarget[] {
  const tomorrow = toUtcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const targets: PreviewTarget[] = [];

  if (tomorrow.getUTCDay() === 5) {
    targets.push({
      cadence: 'weekly',
      targetDate: tomorrow,
      periodKey: tomorrow.toISOString().slice(0, 10),
    });
  }

  if (tomorrow.getUTCDate() === 1) {
    targets.push({
      cadence: 'monthly',
      targetDate: tomorrow,
      periodKey: tomorrow.toISOString().slice(0, 7),
    });
  }

  return targets;
}

function buildRecipientTableHtml(recipients: DigestRecipient[]): string {
  const rows = recipients
    .map(({ member, locale, localeTier }) => {
      const tierLabel = localeTier === 'member' ? 'member preference' : 'site default (member has none)';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e3ede6;">${escapeHtml(member.email)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e3ede6;">${escapeHtml(locale)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e3ede6;">${escapeHtml(tierLabel)}</td>
      </tr>`;
    })
    .join('\n');

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;background:#ffffff;">
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #295640;">Email</th>
        <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #295640;">Resolved locale</th>
        <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #295640;">Fallback tier</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildAdminBannerHtml(params: {
  cadence: SendableDigestCadence;
  siteName: string;
  targetDateLabel: string;
  recipients: DigestRecipient[];
}): string {
  const { cadence, siteName, targetDateLabel, recipients } = params;
  return `<div dir="ltr" style="direction:ltr;text-align:left;max-width:640px;margin:16px auto;padding:20px 24px;background:#fff7e6;border:1px solid #ffe1a8;border-radius:14px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#624b1f;">
    <p style="margin:0 0 10px;font-weight:600;">
      🔍 PREVIEW - ${escapeHtml(cadence)} digest for ${escapeHtml(siteName)}, scheduled to send ${escapeHtml(targetDateLabel)}. No action needed if this looks right - if a locale below is wrong, fix the member's language preference or the site's default locale before then.
    </p>
    <p style="margin:0 0 10px;">${recipients.length} member(s) will receive it:</p>
    ${buildRecipientTableHtml(recipients)}
    <p style="margin:14px 0 0;">The actual compiled digest content follows below.</p>
  </div>`;
}

/** Splices the admin banner right after the digest template's own <body> tag - keeps the
 * digest's own markup/styling untouched, single valid HTML document. */
function injectAdminBanner(html: string, bannerHtml: string): string {
  return html.replace(/<body[^>]*>/i, (match) => `${match}\n${bannerHtml}`);
}

async function resolveAdminRecipient(memberRepo: MemberRepository, siteId: string, ownerUid: string) {
  const ownerMember = await memberRepo.getByUid(siteId, ownerUid);
  if (ownerMember?.email) {
    return {
      email: ownerMember.email,
      name: ownerMember.firstName || ownerMember.displayName || 'Site Admin',
      locale: normalizeLang(ownerMember.defaultLocale) ?? undefined,
    };
  }

  try {
    const authUser = await adminAuth().getUser(ownerUid);
    if (authUser.email) {
      return { email: authUser.email, name: 'Site Admin', locale: undefined };
    }
  } catch (err) {
    console.error(`[cron/digest-preview] could not resolve owner auth record for uid=${ownerUid}:`, err);
  }

  return null;
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

  const targets = resolvePreviewTargets(new Date());
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, previewed: 0, skipped: 0, failed: 0, message: 'No cadence fires in ~24h' });
  }

  const siteRepo = new SiteRepository();
  const memberRepo = new MemberRepository();
  const digestCompiler = new DigestCompilerService();
  const previewSendRepo = new DigestPreviewSendRepository();

  let siteIds: string[] = [];
  try {
    siteIds = await siteRepo.listAllSiteIds();
  } catch (err) {
    console.error('[cron/digest-preview] failed to list site ids:', err);
    return NextResponse.json({ error: 'Failed to list site ids' }, { status: 500 });
  }

  let previewed = 0;
  let skipped = 0;
  let failed = 0;

  for (const siteId of siteIds) {
    for (const target of targets) {
      try {
        if (await previewSendRepo.hasSent(siteId, target.cadence, target.periodKey)) {
          skipped++;
          continue;
        }

        const plan = await resolveDigestSendPlan(siteId, target.cadence);
        if (!plan) {
          // Nobody eligible for this cadence on this site - nothing to preview, don't mark sent
          // (a member opting in later this period should still get a preview if time allows).
          continue;
        }

        const admin = await resolveAdminRecipient(memberRepo, siteId, plan.site.ownerUid);
        if (!admin) {
          console.error(`[cron/digest-preview] no admin email resolvable for site=${siteId} - skipping preview`);
          failed++;
          continue;
        }

        const digest =
          target.cadence === 'monthly'
            ? await digestCompiler.compileMonthlyDigest(siteId, target.targetDate, { locale: DIGEST_SOURCE_LOCALE })
            : await digestCompiler.compileWeeklyDigest(siteId, target.targetDate, { locale: DIGEST_SOURCE_LOCALE });

        const templateOptions = {
          locale: DIGEST_SOURCE_LOCALE,
          siteName: plan.siteName,
          recipientName: admin.name,
          calendarUrl: plan.calendarUrl,
          galleryUrl: plan.galleryUrl,
        };
        const template =
          target.cadence === 'monthly'
            ? DigestTemplateService.buildMonthlyDigestEmail(digest, templateOptions)
            : DigestTemplateService.buildWeeklyDigestEmail(digest, templateOptions);

        const targetDateLabel = target.targetDate.toISOString().slice(0, 10);
        const banner = buildAdminBannerHtml({
          cadence: target.cadence,
          siteName: plan.siteName,
          targetDateLabel,
          recipients: plan.recipients,
        });

        await ResendService.sendTransactionalEmail({
          to: admin.email,
          subject: `[Preview] ${template.subject} - sending ${targetDateLabel}`,
          html: injectAdminBanner(template.html, banner),
          lang: admin.locale ?? DIGEST_SOURCE_LOCALE,
        });

        await previewSendRepo.markSent({ siteId, cadence: target.cadence, periodKey: target.periodKey });
        previewed++;
      } catch (err) {
        failed++;
        console.error(`[cron/digest-preview] error previewing site=${siteId} cadence=${target.cadence}:`, err);
      }
    }
  }

  console.log(
    `[cron/digest-preview] complete: sites=${siteIds.length} previewed=${previewed} skipped=${skipped} failed=${failed}`,
  );
  return NextResponse.json({ ok: true, previewed, skipped, failed });
}
