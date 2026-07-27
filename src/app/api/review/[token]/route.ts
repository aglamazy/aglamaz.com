import { NextRequest } from 'next/server';
import { blogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { ResendService } from '@/services/ResendService';
import { renderEmailHtml } from '@/services/emailTemplates';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const post = await blogRepository.getByReviewToken(token);
  if (!post) {
    return Response.json({ error: 'Review link not found or expired' }, { status: 404 });
  }
  return Response.json({ post });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  let body: { decision?: string; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { decision, feedback } = body;
  if (decision !== 'approved' && decision !== 'changes_requested' && decision !== 'denied') {
    return Response.json({ error: 'decision must be "approved", "changes_requested", or "denied"' }, { status: 400 });
  }
  if ((decision === 'changes_requested' || decision === 'denied') && !feedback?.trim()) {
    return Response.json({ error: 'feedback is required when requesting changes or denying' }, { status: 400 });
  }

  // Read post before deciding so we have siteId / authorId for the notification email
  const prePost = await blogRepository.getByReviewToken(token);
  if (!prePost) {
    return Response.json({ error: 'Review link not found or expired' }, { status: 404 });
  }

  const updated = await blogRepository.decideReview(token, decision, feedback);
  if (!updated) {
    return Response.json({ error: 'Review link not found or expired' }, { status: 404 });
  }

  // Send decision notification to the post's author
  try {
    const fam = new FamilyRepository();
    const author = await fam.getMemberByUserId(prePost.authorId, prePost.siteId);
    const authorEmail = (author as any)?.email as string | undefined;
    if (authorEmail) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      const editLink = `${appUrl}/app/blog/${prePost.id}/edit`;
      const authorName =
        (author as any)?.firstName || (author as any)?.displayName || 'Author';

      const subject =
        decision === 'approved'
          ? 'Your blog post has been published!'
          : decision === 'denied'
            ? 'Your blog post was not approved'
            : 'Review feedback on your blog post';

      const paragraphs =
        decision === 'approved'
          ? ['Your blog post has been reviewed and approved — it is now published.']
          : decision === 'denied'
            ? [
                `Your reviewer decided not to publish this one - the whole angle didn't land, not just a detail:`,
                `<em>${feedback}</em>`,
                `<a href="${editLink}">Click here to edit your post</a>`,
              ]
            : [
                `Your reviewer has requested some changes:`,
                `<em>${feedback}</em>`,
                `<a href="${editLink}">Click here to edit your post</a>`,
              ];

      const html = renderEmailHtml({
        subject,
        greeting: `Hi ${authorName},`,
        paragraphs,
        footerLines: ['FamCircle'],
      });

      await ResendService.sendTransactionalEmail({ to: authorEmail, subject, html });
    }
  } catch (err) {
    console.error('[review/decide] author notification email failed', err);
    // Don't fail the request — the decision was already committed
  }

  // TODO: Notify Shofar of review decision once their webhook route is live.
  // Intended payload: { decision, post_id: prePost.id, feedback }

  return Response.json({ success: true, post: updated });
}
