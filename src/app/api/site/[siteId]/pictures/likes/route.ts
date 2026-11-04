import { withMemberGuard } from '@/lib/withMemberGuard';
import { ImageLikeRepository } from '@/repositories/ImageLikeRepository';
import { fetchPictureLikes } from '@/services/ImageLikesQuery';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/site/[siteId]/pictures/likes
 * Batch-fetch likes for the named images of several items in one request.
 * Body: { items: [{ id, type, indexes: number[] }] } - one Firestore read per index named,
 * nothing more (famcircle#199). `imageCount` is accepted for one release from cached clients.
 * Returns: { byIndex: Record<itemId, Record<imageIndex, ImageLikesResult>>, likes: legacy arrays }
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = context.user!;
    const body = await request.json();

    const outcome = await fetchPictureLikes(new ImageLikeRepository(), body?.items, user.userId, siteId);
    if ('error' in outcome) {
      return Response.json({ error: outcome.error }, { status: 400 });
    }
    return Response.json(outcome.body);
  } catch (error) {
    console.error('[pictures/likes] POST error:', error);
    return Response.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }
};

export const POST = withMemberGuard(postHandler);
