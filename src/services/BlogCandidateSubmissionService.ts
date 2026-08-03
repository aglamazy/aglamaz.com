// Submission side of the Shofar -> aglamaz.com blog pipeline (hopper task-3199 / scout#27).
//
// The review side (draft -> in_review -> Publish/Fix/Deny -> relay-to-Shofar) already
// exists (see BlogAutogenService, src/app/review/[token], scripts/relay-blog-feedback-to-shofar.ts).
// This service is the missing entrypoint: given a {title, content} candidate for a
// specific domain, it creates the draft BlogPost, requests review, and emails the site
// owner a "Review draft" link - mirroring BlogAutogenService.generateForSite's shape, but
// without the FamCircle-only gates (opt-in consent, monthly digest activity, per-period
// dedup) that don't apply to an externally-supplied candidate.
//
// Hard rule (CLAUDE.md landmine, same as BlogAutogenService): this service NEVER writes
// status:'published' - requestReview() below always leaves the post at 'in_review',
// publishing only ever happens through a human's Publish click on /review/[token].
import { SiteRepository } from '@/repositories/SiteRepository';
import { BlogRepository } from '@/repositories/BlogRepository';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml } from '@/services/emailTemplates';
import { adminAuth } from '@/firebase/admin';

export interface BlogCandidateInput {
  title: string;
  content: string;
}

export interface BlogCandidateSubmissionResult {
  siteId: string;
  postId: string;
  reviewToken: string;
}

export class BlogCandidateSubmissionService {
  constructor(
    private readonly siteRepository: SiteRepository = new SiteRepository(),
    private readonly blogRepository: BlogRepository = new BlogRepository(),
    private readonly getUserEmail: (uid: string) => Promise<string | null> = async (uid) => {
      const user = await adminAuth().getUser(uid);
      return user.email || null;
    },
  ) {}

  /**
   * Resolves siteId the same way fetchSiteInfo/resolveSiteId already do for aglamaz.com
   * (domainMappings lookup first, NEXT_SITE_ID env var as the established fallback) rather
   * than guessing a siteId literal - so this works whichever mechanism is actually
   * configured for the given domain.
   */
  private async resolveSiteId(domain: string): Promise<string> {
    const mapped = await this.siteRepository.getIdByDomain(domain);
    if (mapped) return mapped;

    const envSiteId = process.env.NEXT_SITE_ID;
    if (envSiteId) return envSiteId;

    throw new Error(
      `Could not resolve siteId for domain "${domain}": no domainMappings entry and NEXT_SITE_ID is not set.`,
    );
  }

  async submitCandidateForDomain(domain: string, candidate: BlogCandidateInput): Promise<BlogCandidateSubmissionResult> {
    if (!candidate.title?.trim() || !candidate.content?.trim()) {
      throw new Error('Candidate must have a non-empty title and content');
    }

    const siteId = await this.resolveSiteId(domain);

    const site = await this.siteRepository.get(siteId);
    if (!site) {
      throw new Error(`Site ${siteId} (resolved from domain ${domain}) not found`);
    }
    if (!site.defaultLocale) {
      throw new Error(`Site ${siteId} has no defaultLocale configured - cannot draft a post for it`);
    }
    if (!site.ownerUid) {
      throw new Error(`Site ${siteId} has no ownerUid - cannot attribute authorship or notify anyone`);
    }

    const siteName = resolveDigestSiteName(site, site.defaultLocale, siteId);

    const post = await this.blogRepository.create({
      authorId: site.ownerUid,
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
      // Hard rule: never 'published' here - requestReview() below moves it to 'in_review'.
      status: 'draft',
    });

    const reviewToken = await this.blogRepository.requestReview(post.id);

    await this.notifyOwnerOfPendingReview(site.ownerUid, siteId, siteName, reviewToken, post.id, candidate.title).catch((err) => {
      console.error(`[BlogCandidateSubmissionService] owner notification failed for site ${siteId}:`, err);
    });

    return { siteId, postId: post.id, reviewToken };
  }

  private async notifyOwnerOfPendingReview(
    ownerUid: string,
    siteId: string,
    siteName: string,
    reviewToken: string,
    postId: string,
    postTitle: string,
  ): Promise<void> {
    const ownerEmail = await this.getUserEmail(ownerUid);
    if (!ownerEmail) {
      console.warn(`[BlogCandidateSubmissionService] no email for owner ${ownerUid} of site ${siteId} - skipping notification`);
      return;
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const reviewUrl = `${appUrl}/review/${reviewToken}`;
    const subject = `New blog draft for ${siteName} - ready for review`;

    const html = renderEmailHtml({
      subject,
      greeting: 'Hi,',
      paragraphs: [
        `A new blog draft was submitted for ${siteName}: "${postTitle}".`,
        'Please review it before it goes public - nothing is published until you approve it.',
      ],
      button: { label: 'Review draft', url: reviewUrl },
      footerLines: [siteName],
    });

    await ResendService.sendTransactionalEmail({
      to: ownerEmail,
      subject,
      html,
      tracking: appUrl
        ? { origin: appUrl, siteId, recipientMemberId: ownerUid, sendType: 'blog-candidate-submission', sendId: postId }
        : undefined,
    });
  }
}
