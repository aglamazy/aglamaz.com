// Drafts ONE AI-authored blog post per site per month, seeded from that site's real
// recent family activity - reuses DigestCompilerService (the same data assembler
// DigestSendExecutionService/DigestSendPlanService already use for the monthly email
// digest) rather than inventing a new query, so the post is genuinely about what
// happened, not generic filler (famcircle buddy#16).
//
// Hard rule (CLAUDE.md landmine): every post this service writes goes in with
// status:'draft', NEVER 'published'. It then rides the EXISTING human review flow
// (BlogRepository.requestReview → src/app/review/[token] → ReviewPostView) so a family
// admin approves before anything is public. This service never flips status to
// 'published' itself.
//
// Content generation follows the house raw-fetch-to-OpenAI pattern from
// MagazineTemplateSuggesterService: isEnabled() gated on OPENAI_API_KEY, direct fetch to
// api.openai.com/v1/chat/completions, model from OPENAI_MODEL || 'gpt-4o-mini' - no SDK
// dependency added.
import { SiteRepository, resolveSendSettingsForSite } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { BlogRepository } from '@/repositories/BlogRepository';
import { monthKey } from '@/repositories/DigestSendRepository';
import { BlogAutogenRepository, blogAutogenRepository as defaultBlogAutogenRepository } from '@/repositories/BlogAutogenRepository';
import { DigestCompilerService, type DigestEventWithPhotos } from '@/services/DigestCompilerService';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { notifyAdminsOfPendingBlogReview } from '@/services/BlogReviewNotificationService';

export type BlogAutogenOutcome =
  | 'created'
  | 'skipped_disabled'
  | 'skipped_not_opted_in'
  | 'skipped_duplicate'
  | 'skipped_no_locale'
  | 'skipped_no_activity'
  | 'skipped_no_admin';

export interface BlogAutogenResult {
  siteId: string;
  periodKey: string;
  outcome: BlogAutogenOutcome;
  postId?: string;
}

interface DraftedPost {
  title: string;
  content: string;
}

export class BlogAutogenService {
  constructor(
    private readonly siteRepository: SiteRepository = new SiteRepository(),
    private readonly memberRepository: MemberRepository = new MemberRepository(),
    private readonly blogRepository: BlogRepository = new BlogRepository(),
    private readonly digestCompilerService: DigestCompilerService = new DigestCompilerService(),
    private readonly blogAutogenRepository: BlogAutogenRepository = defaultBlogAutogenRepository,
  ) {}

  static isEnabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Drafts (and requests review for) one auto-generated post for `siteId`, for the
   * calendar-month period containing `referenceDate`. Safe to call more than once for the
   * same site+period - the second call is a no-op (`skipped_duplicate`).
   */
  async generateForSite(siteId: string, referenceDate: Date): Promise<BlogAutogenResult> {
    const periodKey = monthKey(referenceDate);

    if (!BlogAutogenService.isEnabled()) {
      return { siteId, periodKey, outcome: 'skipped_disabled' };
    }

    if (await this.blogAutogenRepository.alreadyGenerated(siteId, periodKey)) {
      return { siteId, periodKey, outcome: 'skipped_duplicate' };
    }

    const site = await this.siteRepository.get(siteId);
    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }
    if (!resolveSendSettingsForSite(site).blogAutogen) {
      // Per-site consent gate (famcircle#103), now resolved through the F7-A admin
      // send-settings table (famcircle#119) instead of the standalone blogAutogenEnabled
      // flag - a family must explicitly opt in before any AI-drafted content is created
      // for them. Defaults to off/undefined.
      return { siteId, periodKey, outcome: 'skipped_not_opted_in' };
    }
    if (!site.defaultLocale) {
      // Same gap resolveDigestRecipients guards against (SiteDefaultLocaleMissingError) -
      // here it's a skip, not a hard failure, since an unconfigured site simply isn't
      // ready for autogen yet, not a cron error.
      return { siteId, periodKey, outcome: 'skipped_no_locale' };
    }

    const digest = await this.digestCompilerService.compileMonthlyDigest(siteId, referenceDate, {
      locale: site.defaultLocale,
    });

    if (digest.pastEvents.length === 0) {
      // Nothing genuinely happened this period - skip rather than write filler.
      return { siteId, periodKey, outcome: 'skipped_no_activity' };
    }

    const admins = await this.memberRepository.listBySite(siteId, { roles: ['admin'] });
    const author = admins.find((m) => !!m.uid);
    if (!author) {
      // No admin to attribute authorship to or to notify - nothing safe to do.
      return { siteId, periodKey, outcome: 'skipped_no_admin' };
    }

    const siteName = resolveDigestSiteName(site, site.defaultLocale, siteId);
    const draft = await this.draftPostContent({
      siteName,
      locale: site.defaultLocale,
      pastEvents: digest.pastEvents,
    });

    const post = await this.blogRepository.create({
      authorId: author.uid,
      siteId,
      primaryLocale: site.defaultLocale,
      isPublic: true,
      localeContent: {
        title: draft.title,
        content: draft.content,
        engine: 'gpt',
        sourceLocale: site.defaultLocale,
      },
      contentFormat: 'md',
      // Hard rule: never 'published' here - requestReview() below moves it to
      // 'in_review'; only a human decideReview('approved') call can ever publish it.
      status: 'draft',
    });

    const reviewToken = await this.blogRepository.requestReview(post.id);
    await this.blogAutogenRepository.markGenerated(siteId, periodKey, post.id);

    // Best-effort notification - a failed email must not undo the draft that was already
    // safely created (mirrors the author-notification try/catch in
    // src/app/api/review/[token]/route.ts).
    await notifyAdminsOfPendingBlogReview({
      siteId,
      postId: post.id,
      postTitle: draft.title,
      reviewToken,
      sendType: 'blog-autogen-admin',
      subject: `New auto-drafted blog post for ${siteName}`,
      paragraphs: [
        `We drafted a new blog post for ${siteName} based on this month's family activity: "${draft.title}".`,
        'Please review it before it goes public - nothing is published until you approve it.',
      ],
    }).catch((err) => {
      console.error(`[BlogAutogenService] admin notification failed for site ${siteId}:`, err);
    });

    return { siteId, periodKey, outcome: 'created', postId: post.id };
  }

  /**
   * Raw OpenAI call - same shape as MagazineTemplateSuggesterService.suggestTemplate, but
   * asks for a JSON {title, content} pair (via response_format: json_object) instead of a
   * fenced HTML block, since a blog post needs a separate title.
   */
  private async draftPostContent(input: {
    siteName: string;
    locale: string;
    pastEvents: DigestEventWithPhotos[];
  }): Promise<DraftedPost> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const eventLines = input.pastEvents.map(({ event }) => {
      const bits = [`${event.name} (${event.type})`];
      if (event.description?.trim()) bits.push(`- ${event.description.trim()}`);
      return `- ${bits.join(' ')}`;
    });

    const sys = `You are a warm family-blog ghostwriter. Draft ONE short blog post (3-5 short paragraphs) celebrating a family's recent activity, based ONLY on the events listed below - never invent people, dates, or events that aren't given.
Write in locale "${input.locale}". Output the post body as Markdown (no HTML tags).
Respond with ONLY a JSON object of the shape {"title": "...", "content": "..."} - no markdown code fences, no commentary outside the JSON.`;

    const userPrompt = [
      `Family/site name: ${input.siteName}`,
      '',
      'Recent family activity to write about:',
      ...eventLines,
    ].join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const raw: string = (data.choices?.[0]?.message?.content || '').trim();

    let parsed: { title?: string; content?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`OpenAI returned non-JSON content: ${raw.slice(0, 200)}`);
    }

    const title = parsed.title?.trim();
    const content = parsed.content?.trim();
    if (!title || !content) {
      throw new Error('OpenAI returned an empty title or content');
    }

    return { title, content };
  }
}

export const blogAutogenService = new BlogAutogenService();
