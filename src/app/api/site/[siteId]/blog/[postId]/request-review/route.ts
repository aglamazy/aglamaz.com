import { withMemberGuard } from '@/lib/withMemberGuard';
import { blogRepository } from '@/repositories/BlogRepository';
import { notifyAdminsOfPendingBlogReview } from '@/services/BlogReviewNotificationService';
import type { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const postHandler = async (
  _request: Request,
  context: GuardContext & { params: Promise<{ siteId: string; postId: string }> },
) => {
  try {
    const params = await context.params;
    const { siteId, postId } = params;

    if (!siteId || !postId) {
      return Response.json({ error: 'Missing siteId or postId' }, { status: 400 });
    }
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const post = await blogRepository.getById(postId);
    if (!post) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (post.authorId !== context.user!.userId && context.member?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const token = await blogRepository.requestReview(postId);
    const postTitle = post.locales?.[post.primaryLocale]?.title || '(untitled)';

    // notifyAdminsOfPendingBlogReview swallows per-recipient send failures internally
    // and always resolves reviewUrl - the in-app "submit for review" button redirects
    // the browser there regardless of whether the notification email went out.
    const { reviewUrl } = await notifyAdminsOfPendingBlogReview({
      siteId,
      postId,
      postTitle,
      reviewToken: token,
    });

    return Response.json({ token, reviewUrl });
  } catch (error) {
    console.error('[request-review] error', error);
    return Response.json({ error: 'Failed to request review' }, { status: 500 });
  }
};

export const POST = withMemberGuard(postHandler);
