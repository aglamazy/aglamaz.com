// Accepts a blog-post candidate {title, content} authored externally by Shofar (Buddy's
// blog-drafting session) and routes it through the EXISTING draft -> review -> publish
// pipeline (task #10 / scout#27, 2026-08-03) - same shape as BlogAutogenService.generateForSite,
// just fed by Shofar's own draft instead of an OpenAI call against DigestCompilerService data.
//
// Hard rule (CLAUDE.md landmine, verbatim from BlogAutogenService): every post this
// service writes goes in with status:'draft', NEVER 'published'. It rides the same human
// review flow (BlogRepository.requestReview -> src/app/review/[token]) so a family admin
// approves before anything is public. This service never flips status to 'published' itself.
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository, type LocalizedMemberRecord } from '@/repositories/MemberRepository';
import { BlogRepository } from '@/repositories/BlogRepository';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml } from '@/services/emailTemplates';

export type ShofarBlogSubmissionOutcome = 'created' | 'skipped_no_locale' | 'skipped_no_admin';

export interface ShofarBlogSubmissionResult {
  siteId: string;
  outcome: ShofarBlogSubmissionOutcome;
  postId?: string;
  reviewToken?: string;
}

export interface BlogCandidate {
  title: string;
  content: string;
}

export class ShofarBlogSubmissionService {
  constructor(
    private readonly siteRepository: SiteRepository = new SiteRepository(),
    private readonly memberRepository: MemberRepository = new MemberRepository(),
    private readonly blogRepository: BlogRepository = new BlogRepository(),
  ) {}

  /** Drafts (and requests review for) one Shofar-submitted post for `siteId`. */
  async submitCandidate(siteId: string, candidate: BlogCandidate): Promise<ShofarBlogSubmissionResult> {
    const site = await this.siteRepository.get(siteId);
    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }
    if (!site.defaultLocale) {
      // Same gap BlogAutogenService guards against - an unconfigured site isn't ready
      // to receive a draft in an unknown locale yet.
      return { siteId, outcome: 'skipped_no_locale' };
    }

    const admins = await this.memberRepository.listBySite(siteId, { roles: ['admin'] });
    const author = admins.find((m) => !!m.uid);
    if (!author) {
      // No admin to attribute authorship to or to notify - nothing safe to do.
      return { siteId, outcome: 'skipped_no_admin' };
    }

    const post = await this.blogRepository.create({
      authorId: author.uid,
      siteId,
      primaryLocale: site.defaultLocale,
      isPublic: true,
      localeContent: {
        title: candidate.title,
        content: candidate.content,
        engine: 'gpt',
        sourceLocale: site.defaultLocale,
      },
      contentFormat: 'md',
      // Hard rule: never 'published' here - requestReview() below moves it to
      // 'in_review'; only a human decideReview('approved') call can ever publish it.
      status: 'draft',
    });

    const reviewToken = await this.blogRepository.requestReview(post.id);

    const siteName = resolveDigestSiteName(site, site.defaultLocale, siteId);
    // Best-effort notification - a failed email must not undo the draft that was already
    // safely created (mirrors BlogAutogenService's own admin-notification try/catch).
    await this.notifyAdminsOfPendingReview(siteId, admins, siteName, reviewToken, post.id, candidate.title).catch((err) => {
      console.error(`[ShofarBlogSubmissionService] admin notification failed for site ${siteId}:`, err);
    });

    return { siteId, outcome: 'created', postId: post.id, reviewToken };
  }

  private async notifyAdminsOfPendingReview(
    siteId: string,
    admins: LocalizedMemberRecord[],
    siteName: string,
    reviewToken: string,
    postId: string,
    postTitle: string,
  ): Promise<void> {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const reviewUrl = `${appUrl}/review/${reviewToken}`;
    const subject = `New blog draft ready for review: ${siteName}`;

    const recipients = admins.filter((admin): admin is LocalizedMemberRecord & { email: string } => !!admin.email);
    await Promise.all(
      recipients.map((admin) => {
        const html = renderEmailHtml({
          subject,
          greeting: `Hi ${admin.firstName || admin.displayName || 'there'},`,
          paragraphs: [
            `Shofar drafted a new blog post for ${siteName}: "${postTitle}".`,
            'Please review it before it goes public - nothing is published until you approve it.',
          ],
          button: { label: 'Review draft', url: reviewUrl },
          footerLines: ['FamCircle'],
        });
        return ResendService.sendTransactionalEmail({
          to: admin.email,
          subject,
          html,
          tracking: appUrl
            ? { origin: appUrl, siteId, recipientMemberId: admin.id, sendType: 'blog-shofar-submit', sendId: postId }
            : undefined,
        });
      }),
    );
  }
}
