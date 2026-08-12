// Shared by BlogAutogenService (monthly cron drafts) and the request-review API route
// (both the in-app "submit for review" button and, per Agla 2026-08-12, Shofar's headless
// CLI submissions) - one place that emails site admins a review-page link whenever a post
// enters 'in_review'. Previously only BlogAutogenService did this; the API route just
// returned the token/URL and relied on a human being redirected there in-browser, which
// doesn't work for a headless caller.
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository, type LocalizedMemberRecord } from '@/repositories/MemberRepository';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml } from '@/services/emailTemplates';
import { getBaseUrlForSite } from '@/utils/serverUrls';
import type { EmailTrackingSendType } from '@/services/EmailTrackingService';

export async function notifyAdminsOfPendingBlogReview(params: {
  siteId: string;
  postId: string;
  postTitle: string;
  reviewToken: string;
  /** 'blog-autogen-admin' for the monthly-cron path (BlogAutogenService), so its own
   * usage-data tracking stays distinct from manual/CLI-triggered review requests. */
  sendType?: EmailTrackingSendType;
  /** Override the default subject/copy - BlogAutogenService uses autogen-specific wording. */
  subject?: string;
  paragraphs?: string[];
}): Promise<{ reviewUrl: string }> {
  const { siteId, postId, postTitle, reviewToken, sendType = 'blog-review-request' } = params;
  const siteRepository = new SiteRepository();
  const memberRepository = new MemberRepository();

  const baseUrl = await getBaseUrlForSite(siteId);
  const reviewUrl = `${baseUrl}/review/${reviewToken}`;

  const site = await siteRepository.get(siteId);
  const siteName = site ? resolveDigestSiteName(site, site.defaultLocale, siteId) : siteId;

  const admins = await memberRepository.listBySite(siteId, { roles: ['admin'] });
  const recipients = admins.filter((admin): admin is LocalizedMemberRecord & { email: string } => !!admin.email);

  const subject = params.subject ?? `Blog post ready for your review - ${siteName}`;
  const paragraphs = params.paragraphs ?? [
    `A blog post is waiting for your review on ${siteName}: "${postTitle}".`,
    'Please review it before it goes public - nothing is published until you approve it.',
  ];
  // The review link itself must come back reliably even if a recipient's email send
  // fails - a caller (e.g. the in-app "submit for review" button) redirects the browser
  // to reviewUrl regardless of notification success, so per-recipient send failures are
  // swallowed here rather than propagated.
  await Promise.all(
    recipients.map(async (admin) => {
      const html = renderEmailHtml({
        subject,
        greeting: `Hi ${admin.firstName || admin.displayName || 'there'},`,
        paragraphs,
        button: { label: 'Review draft', url: reviewUrl },
        footerLines: ['FamCircle'],
      });
      try {
        await ResendService.sendTransactionalEmail({
          to: admin.email,
          subject,
          html,
          tracking: { origin: baseUrl, siteId, recipientMemberId: admin.id, sendType, sendId: postId },
        });
      } catch (err) {
        console.error(`[notifyAdminsOfPendingBlogReview] send failed for admin ${admin.id}:`, err);
      }
    }),
  );

  return { reviewUrl };
}
