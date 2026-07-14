import { blogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { localizeBlogPost } from '@/utils/blogLocales';
import { sendTransactionalEmail } from '@/services/ResendService';
import type { BlogPostReviewDecision, IBlogPost } from '@/entities/BlogPost';

// Public, token-gated review route - deliberately NOT wrapped in withMemberGuard.
// The reviewToken itself is the auth: anyone with the (short-lived) link can view
// and decide, matching the "hand a reviewer a link" use case in famcircle#15.
export const dynamic = 'force-dynamic';

function parseLocale(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = value.split(',')[0]?.trim();
  if (!raw) return undefined;
  const code = raw.split(';')[0]?.trim();
  return code ? code.toLowerCase() : undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
}

async function notifyAuthor(post: IBlogPost, decision: BlogPostReviewDecision, feedback?: string) {
  try {
    const fam = new FamilyRepository();
    const author = await fam.getMemberByUserId(post.authorId, post.siteId);
    if (!author?.email) return;

    const localized = localizeBlogPost(post, {
      preferredLocale: post.primaryLocale,
      fallbackLocales: [post.primaryLocale],
    }).localized;
    const title = localized.title || post.id;

    if (decision === 'approved') {
      await sendTransactionalEmail({
        to: author.email,
        subject: 'Your post was published',
        html: `<p>Your post "${escapeHtml(title)}" was approved and is now published.</p>`,
      });
    } else {
      const editUrl = `${resolveBaseUrl()}/app/blog/${post.id}/edit`;
      await sendTransactionalEmail({
        to: author.email,
        subject: 'Changes requested on your post',
        html: [
          `<p>A reviewer requested changes on "${escapeHtml(title)}":</p>`,
          `<blockquote>${escapeHtml(feedback || '')}</blockquote>`,
          `<p><a href="${escapeHtml(editUrl)}">Edit your post</a></p>`,
        ].join(''),
      });
    }
  } catch (error) {
    console.error('[review] failed to notify author', error);
  }
}

export const GET = async (request: Request, { params }: { params: Promise<{ token: string }> }) => {
  try {
    const { token } = await params;
    const post = await blogRepository.getByReviewToken(token);
    if (!post) {
      return Response.json({ error: 'Review link not found or expired' }, { status: 404 });
    }
    const preferred = parseLocale(request.headers.get('accept-language')) || post.primaryLocale;
    const localized = localizeBlogPost(post, {
      preferredLocale: preferred,
      fallbackLocales: [post.primaryLocale],
    });
    return Response.json({ post, localized: localized.localized });
  } catch (error) {
    console.error('[review] failed to fetch post by token', error);
    return Response.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
};

export const POST = async (request: Request, { params }: { params: Promise<{ token: string }> }) => {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const decision = body?.decision as BlogPostReviewDecision | undefined;
    const feedback = typeof body?.feedback === 'string' ? body.feedback : undefined;
    if (decision !== 'approved' && decision !== 'changes_requested') {
      return Response.json({ error: 'Invalid decision' }, { status: 400 });
    }

    const updated = await blogRepository.decideReview(token, decision, feedback);
    if (!updated) {
      return Response.json({ error: 'Review link not found or expired' }, { status: 404 });
    }

    await notifyAuthor(updated, decision, feedback);

    // TODO(famcircle#15 follow-up): once Shofar's review-decision webhook route is
    // live, POST this decision to it so their authoring pipeline can react. Intended
    // payload: { decision, post_id: updated.id, feedback }. Blocked on Shofar
    // publishing that endpoint (tracked in Shofar's own project, not this one).

    return Response.json({ success: true, post: updated });
  } catch (error) {
    console.error('[review] failed to decide review', error);
    return Response.json({ error: 'Failed to record decision' }, { status: 500 });
  }
};
